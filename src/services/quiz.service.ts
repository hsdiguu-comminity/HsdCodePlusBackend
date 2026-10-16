import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/errors";
import { addScoreEvent, gradeAnswers } from "@/lib/scoring";
import { AuditActions, logAdminAction } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateQuizInput,
  QuestionInput,
  SubmitQuizInput,
  UpdateQuizInput,
} from "@/lib/validations/quiz";

// Ağ gecikmesi için süre bitiminden sonra tanınan ek süre
const SUBMIT_GRACE_MS = 5_000;

type QuizWindow = { startsAt: Date | null; endsAt: Date | null };

export function getQuizWindowStatus(quiz: QuizWindow, now = new Date()) {
  if (quiz.startsAt && quiz.startsAt > now) return "UPCOMING" as const;
  if (quiz.endsAt && quiz.endsAt <= now) return "ENDED" as const;
  return "ACTIVE" as const;
}

function attemptDeadline(startedAt: Date, timeLimitSec: number) {
  return new Date(startedAt.getTime() + timeLimitSec * 1000);
}

// ---------------- Herkese açık ----------------

export async function listPublishedQuizzes(categorySlug?: string) {
  const quizzes = await prisma.quiz.findMany({
    where: {
      isPublished: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    timeLimitSec: quiz.timeLimitSec,
    startsAt: quiz.startsAt,
    endsAt: quiz.endsAt,
    status: getQuizWindowStatus(quiz),
    questionCount: quiz._count.questions,
    attemptCount: quiz._count.attempts,
  }));
}

// Quiz detayı: sorular burada GÖNDERİLMEZ, yalnızca /start ile alınır
// (böylece sorular süre başlamadan görülüp araştırılamaz)
export async function getPublishedQuiz(quizId: string, userId?: string) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isPublished: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      questions: { select: { points: true } },
    },
  });
  if (!quiz) throw Errors.notFound("Quiz bulunamadı");

  const attempt = userId
    ? await prisma.quizAttempt.findUnique({
        where: { userId_quizId: { userId, quizId } },
        select: { score: true, startedAt: true, finishedAt: true },
      })
    : null;

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    category: quiz.category,
    timeLimitSec: quiz.timeLimitSec,
    startsAt: quiz.startsAt,
    endsAt: quiz.endsAt,
    status: getQuizWindowStatus(quiz),
    questionCount: quiz.questions.length,
    totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    // Giriş yapmış kullanıcının bu quizdeki durumu (giriş yoksa null)
    myAttempt: attempt,
  };
}

async function loadQuestionsForPlayer(quizId: string) {
  return prisma.question.findMany({
    where: { quizId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      text: true,
      points: true,
      order: true,
      // isCorrect bilerek seçilmez — doğru cevap istemciye gitmez
      options: { select: { id: true, text: true }, orderBy: { id: "asc" } },
    },
  });
}

// ---------------- Quiz çözme ----------------

export async function startQuiz(userId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, isPublished: true } });
  if (!quiz) throw Errors.notFound("Quiz bulunamadı");

  const now = new Date();
  let attempt = await prisma.quizAttempt.findUnique({
    where: { userId_quizId: { userId, quizId } },
  });

  if (attempt?.finishedAt) {
    throw new ApiError(409, "ALREADY_ATTEMPTED", "Bu quizi daha önce çözdünüz");
  }

  if (attempt) {
    // Yarıda kalan deneme (ör. sayfa yenilendi): süre bitmediyse kaldığı yerden devam
    const deadline = attemptDeadline(attempt.startedAt, quiz.timeLimitSec);
    if (now.getTime() > deadline.getTime() + SUBMIT_GRACE_MS) {
      await prisma.quizAttempt.updateMany({
        where: { id: attempt.id, finishedAt: null },
        data: { finishedAt: now, score: 0 },
      });
      throw new ApiError(409, "TIME_UP", "Bu quizin süresi doldu");
    }
  } else {
    const windowStatus = getQuizWindowStatus(quiz, now);
    if (windowStatus === "UPCOMING") {
      throw new ApiError(400, "QUIZ_NOT_STARTED", "Bu quiz henüz başlamadı");
    }
    if (windowStatus === "ENDED") {
      throw new ApiError(400, "QUIZ_ENDED", "Bu quizin süresi sona erdi");
    }

    try {
      attempt = await prisma.quizAttempt.create({ data: { userId, quizId, startedAt: now } });
    } catch (error) {
      // Aynı anda iki "başlat" isteği gelirse ikincisi mevcut denemeyi kullanır
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        attempt = await prisma.quizAttempt.findUniqueOrThrow({
          where: { userId_quizId: { userId, quizId } },
        });
      } else {
        throw error;
      }
    }
  }

  const questions = await loadQuestionsForPlayer(quizId);

  return {
    attemptId: attempt.id,
    quiz: { id: quiz.id, title: quiz.title, timeLimitSec: quiz.timeLimitSec },
    startedAt: attempt.startedAt,
    expiresAt: attemptDeadline(attempt.startedAt, quiz.timeLimitSec),
    questions,
  };
}

export async function submitQuiz(userId: string, quizId: string, input: SubmitQuizInput) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { userId_quizId: { userId, quizId } },
    include: {
      quiz: {
        select: {
          timeLimitSec: true,
          questions: {
            select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } },
          },
        },
      },
    },
  });

  if (!attempt) throw new ApiError(400, "NOT_STARTED", "Önce quizi başlatmalısınız");
  if (attempt.finishedAt) {
    throw new ApiError(409, "ALREADY_SUBMITTED", "Bu quiz için cevaplarınız zaten gönderildi");
  }

  const now = new Date();
  const deadline = attemptDeadline(attempt.startedAt, attempt.quiz.timeLimitSec);
  if (now.getTime() > deadline.getTime() + SUBMIT_GRACE_MS) {
    // Süre geçtikten sonra gelen cevaplar puanlanmaz
    await prisma.quizAttempt.updateMany({
      where: { id: attempt.id, finishedAt: null },
      data: { finishedAt: now, score: 0 },
    });
    throw new ApiError(400, "TIME_UP", "Süre dolduğu için cevaplarınız kabul edilmedi");
  }

  const { score, totalPoints, correctCount, results, accepted } = gradeAnswers(
    attempt.quiz.questions,
    input.answers
  );

  await prisma.$transaction(async (tx) => {
    // Yalnızca hâlâ açık olan denemeyi kapat (aynı anda iki gönderim olursa biri reddedilir)
    const { count } = await tx.quizAttempt.updateMany({
      where: { id: attempt.id, finishedAt: null },
      data: { finishedAt: now, score },
    });
    if (count === 0) {
      throw new ApiError(409, "ALREADY_SUBMITTED", "Bu quiz için cevaplarınız zaten gönderildi");
    }

    if (accepted.size > 0) {
      await tx.attemptAnswer.createMany({
        data: [...accepted].map(([questionId, optionId]) => ({
          attemptId: attempt.id,
          questionId,
          optionId,
        })),
      });
    }

    if (score > 0) {
      await addScoreEvent({ userId, points: score, source: "QUIZ", refId: quizId }, tx);
    }
  });

  // Doğru şıkların kendisi gönderilmez; yalnızca kullanıcının cevabı doğru mu yanlış mı
  return {
    score,
    totalPoints,
    correctCount,
    questionCount: results.length,
    results,
  };
}

// ---------------- Admin ----------------

const adminQuizInclude = {
  category: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, username: true } },
  _count: { select: { questions: true, attempts: true } },
} satisfies Prisma.QuizInclude;

export function listAllQuizzes() {
  return prisma.quiz.findMany({ orderBy: { createdAt: "desc" }, include: adminQuizInclude });
}

export async function getQuizForAdmin(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      ...adminQuizInclude,
      questions: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { options: { orderBy: { id: "asc" } } },
      },
    },
  });
  if (!quiz) throw Errors.notFound("Quiz bulunamadı");
  return quiz;
}

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw Errors.badRequest("Seçilen kategori bulunamadı");
}

export async function createQuiz(adminId: string, input: CreateQuizInput) {
  await assertCategoryExists(input.categoryId);

  return prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId,
        timeLimitSec: input.timeLimitSec,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        isPublished: false,
        createdById: adminId,
      },
      include: adminQuizInclude,
    });
    await logAdminAction(
      { adminId, action: AuditActions.QUIZ_CREATE, targetType: "QUIZ", targetId: quiz.id },
      tx
    );
    return quiz;
  });
}

// Yayınlanmadan önce quizin eksiksiz olduğunu kontrol eder
async function assertQuizPublishable(quizId: string) {
  const questions = await prisma.question.findMany({
    where: { quizId },
    include: { options: { select: { isCorrect: true } } },
  });
  if (questions.length === 0) {
    throw new ApiError(400, "QUIZ_INCOMPLETE", "Yayınlamak için en az bir soru eklenmeli");
  }
  const broken = questions.find(
    (q) => q.options.length < 2 || q.options.filter((o) => o.isCorrect).length !== 1
  );
  if (broken) {
    throw new ApiError(
      400,
      "QUIZ_INCOMPLETE",
      "Her sorunun en az 2 şıkkı ve tam olarak bir doğru cevabı olmalı"
    );
  }
}

export async function updateQuiz(adminId: string, quizId: string, input: UpdateQuizInput) {
  const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!existing) throw Errors.notFound("Quiz bulunamadı");

  if (input.categoryId) await assertCategoryExists(input.categoryId);

  const startsAt = input.startsAt !== undefined ? input.startsAt : existing.startsAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw Errors.badRequest("Bitiş tarihi başlangıçtan sonra olmalı");
  }

  if (input.isPublished === true && !existing.isPublished) {
    await assertQuizPublishable(quizId);
  }

  const action =
    input.isPublished === true && !existing.isPublished
      ? AuditActions.QUIZ_PUBLISH
      : input.isPublished === false && existing.isPublished
        ? AuditActions.QUIZ_UNPUBLISH
        : AuditActions.QUIZ_UPDATE;

  return prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.update({
      where: { id: quizId },
      data: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        timeLimitSec: input.timeLimitSec,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isPublished: input.isPublished,
      },
      include: adminQuizInclude,
    });
    await logAdminAction({ adminId, action, targetType: "QUIZ", targetId: quizId }, tx);
    return quiz;
  });
}

// Çözülmüş bir quizin soruları değiştirilirse puanlar tutarsız olur; bu yüzden engellenir
async function assertNoAttempts(quizId: string) {
  const attempts = await prisma.quizAttempt.count({ where: { quizId } });
  if (attempts > 0) {
    throw new ApiError(
      409,
      "QUIZ_HAS_ATTEMPTS",
      "Bu quiz çözülmeye başlandığı için soruları değiştirilemez veya silinemez"
    );
  }
}

export async function deleteQuiz(adminId: string, quizId: string) {
  const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!existing) throw Errors.notFound("Quiz bulunamadı");
  await assertNoAttempts(quizId);

  await prisma.$transaction(async (tx) => {
    await tx.quiz.delete({ where: { id: quizId } });
    await logAdminAction(
      { adminId, action: AuditActions.QUIZ_DELETE, targetType: "QUIZ", targetId: quizId },
      tx
    );
  });
}

export async function listQuestions(quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
  if (!quiz) throw Errors.notFound("Quiz bulunamadı");
  return prisma.question.findMany({
    where: { quizId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: { options: { orderBy: { id: "asc" } } },
  });
}

export async function createQuestion(adminId: string, quizId: string, input: QuestionInput) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
  if (!quiz) throw Errors.notFound("Quiz bulunamadı");
  await assertNoAttempts(quizId);

  const order = input.order ?? (await prisma.question.count({ where: { quizId } }));

  return prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        quizId,
        text: input.text,
        points: input.points,
        order,
        options: { create: input.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
      },
      include: { options: { orderBy: { id: "asc" } } },
    });
    await logAdminAction(
      { adminId, action: AuditActions.QUESTION_CREATE, targetType: "QUESTION", targetId: question.id },
      tx
    );
    return question;
  });
}

async function findQuestionInQuiz(quizId: string, questionId: string) {
  const question = await prisma.question.findFirst({ where: { id: questionId, quizId } });
  if (!question) throw Errors.notFound("Soru bulunamadı");
  return question;
}

// Şıklar her güncellemede tamamen yenilenir
export async function updateQuestion(
  adminId: string,
  quizId: string,
  questionId: string,
  input: QuestionInput
) {
  await findQuestionInQuiz(quizId, questionId);
  await assertNoAttempts(quizId);

  return prisma.$transaction(async (tx) => {
    await tx.option.deleteMany({ where: { questionId } });
    const question = await tx.question.update({
      where: { id: questionId },
      data: {
        text: input.text,
        points: input.points,
        order: input.order,
        options: { create: input.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
      },
      include: { options: { orderBy: { id: "asc" } } },
    });
    await logAdminAction(
      { adminId, action: AuditActions.QUESTION_UPDATE, targetType: "QUESTION", targetId: questionId },
      tx
    );
    return question;
  });
}

export async function deleteQuestion(adminId: string, quizId: string, questionId: string) {
  await findQuestionInQuiz(quizId, questionId);
  await assertNoAttempts(quizId);

  await prisma.$transaction(async (tx) => {
    await tx.question.delete({ where: { id: questionId } });
    await logAdminAction(
      { adminId, action: AuditActions.QUESTION_DELETE, targetType: "QUESTION", targetId: questionId },
      tx
    );
  });
}
