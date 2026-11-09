import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SubmittedAnswer = {
  questionId: number;
  optionId: number;
};

type SubmitBody = {
  attemptId: number;
  answers: SubmittedAnswer[];
};

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    // 1. Oturum kontrolü
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçersiz kullanıcı." },
        { status: 400 }
      );
    }

    // 2. Kullanıcı aktif mi?
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Aktif kullanıcı bulunamadı." },
        { status: 403 }
      );
    }

    // 3. Quiz ID kontrolü
    const { id } = await params;
    const quizId = Number(id);

    if (!Number.isSafeInteger(quizId) || quizId <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçersiz quiz ID." },
        { status: 400 }
      );
    }

    // 4. JSON gövdesini oku
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Geçersiz JSON verisi." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, message: "İstek verisi geçersiz." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    // 5. Attempt ID kontrolü
    if (
      typeof data.attemptId !== "number" ||
      !Number.isSafeInteger(data.attemptId) ||
      data.attemptId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçerli bir attemptId gönderilmelidir.",
        },
        { status: 400 }
      );
    }

    const attemptId = data.attemptId;

    // 6. Cevap dizisi kontrolü
    if (!Array.isArray(data.answers)) {
      return NextResponse.json(
        { success: false, message: "Cevaplar bir dizi olmalıdır." },
        { status: 400 }
      );
    }

    if (data.answers.length > 500) {
      return NextResponse.json(
        { success: false, message: "Çok fazla cevap gönderildi." },
        { status: 400 }
      );
    }

    const answers: SubmittedAnswer[] = [];

    for (const answer of data.answers) {
      if (
        typeof answer !== "object" ||
        answer === null ||
        Array.isArray(answer)
      ) {
        return NextResponse.json(
          { success: false, message: "Cevap formatı geçersiz." },
          { status: 400 }
        );
      }

      const item = answer as Record<string, unknown>;

      if (
        typeof item.questionId !== "number" ||
        !Number.isSafeInteger(item.questionId) ||
        item.questionId <= 0 ||
        typeof item.optionId !== "number" ||
        !Number.isSafeInteger(item.optionId) ||
        item.optionId <= 0
      ) {
        return NextResponse.json(
          { success: false, message: "Cevap formatı geçersiz." },
          { status: 400 }
        );
      }

      answers.push({
        questionId: item.questionId,
        optionId: item.optionId,
      });
    }

    // 7. Aynı soruya birden fazla cevap verilmesini engelle
    const questionIds = answers.map((answer) => answer.questionId);

    if (new Set(questionIds).size !== questionIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Aynı soru için birden fazla cevap gönderilemez.",
        },
        { status: 400 }
      );
    }

    // 8. Puanlama ve kayıt işlemleri
    const result = await prisma.$transaction(
      async (tx) => {
        const attempt = await tx.quizAttempt.findFirst({
          where: {
            id: attemptId,
            userId,
            quizId,
          },
          include: {
            quiz: {
              select: {
                timeLimitSec: true,
                endsAt: true,
                questions: {
                  select: {
                    id: true,
                    points: true,
                    options: {
                      select: {
                        id: true,
                        isCorrect: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!attempt) {
          return { error: "ATTEMPT_NOT_FOUND" as const };
        }

        if (attempt.finishedAt !== null) {
          return { error: "ALREADY_FINISHED" as const };
        }

        const now = new Date();

        const timeLimitExpired =
          attempt.quiz.timeLimitSec !== null &&
          now.getTime() - attempt.startedAt.getTime() >=
            attempt.quiz.timeLimitSec * 1000;

        const quizPeriodExpired =
          attempt.quiz.endsAt !== null &&
          now.getTime() > attempt.quiz.endsAt.getTime();

        // 9. Süre veya quiz yayın dönemi dolmuş mu?
        if (timeLimitExpired || quizPeriodExpired) {
          const expired = await tx.quizAttempt.updateMany({
            where: {
              id: attemptId,
              userId,
              quizId,
              finishedAt: null,
            },
            data: {
              score: 0,
              finishedAt: now,
            },
          });

          if (expired.count !== 1) {
            return { error: "ALREADY_FINISHED" as const };
          }

          return { error: "TIME_EXPIRED" as const };
        }

        const questions = attempt.quiz.questions;

        // 10. Bütün sorular cevaplanmış mı?
        if (
          questions.length === 0 ||
          answers.length !== questions.length
        ) {
          return { error: "INCOMPLETE_ANSWERS" as const };
        }

        const questionMap = new Map(
          questions.map((question) => [question.id, question])
        );

        let score = 0;
        let correctAnswers = 0;

        // 11. Soruları ve seçenekleri doğrula, puanı hesapla
        for (const answer of answers) {
          const question = questionMap.get(answer.questionId);

          if (!question) {
            return { error: "INVALID_QUESTION" as const };
          }

          const option = question.options.find(
            (item) => item.id === answer.optionId
          );

          if (!option) {
            return { error: "INVALID_OPTION" as const };
          }

          if (option.isCorrect) {
            score += question.points;
            correctAnswers++;
          }
        }

        // 12. Denemeyi yalnızca bir kez tamamla
        const updated = await tx.quizAttempt.updateMany({
          where: {
            id: attemptId,
            userId,
            quizId,
            finishedAt: null,
          },
          data: {
            score,
            finishedAt: now,
          },
        });

        if (updated.count !== 1) {
          return { error: "ALREADY_FINISHED" as const };
        }

        // 13. Cevapları kaydet
        await tx.attemptAnswer.createMany({
          data: answers.map((answer) => ({
            attemptId,
            questionId: answer.questionId,
            optionId: answer.optionId,
          })),
        });

        // 14. Puan etkinliğini kaydet
        if (score > 0) {
          await tx.scoreEvent.create({
            data: {
              userId,
              points: score,
              source: "QUIZ",
              refId: attemptId,
            },
          });
        }

        return {
          score,
          totalQuestions: questions.length,
          correctAnswers,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // 15. İşlem sonuçlarını HTTP yanıtlarına dönüştür
    if ("error" in result) {
      const responses = {
        ATTEMPT_NOT_FOUND: {
          status: 404,
          message: "Deneme bulunamadı.",
        },
        ALREADY_FINISHED: {
          status: 409,
          message: "Bu deneme daha önce tamamlanmış.",
        },
        TIME_EXPIRED: {
          status: 410,
          message:
            "Quiz süresi veya yayın dönemi doldu. Denemeniz sıfır puanla kapatıldı.",
        },
        INCOMPLETE_ANSWERS: {
          status: 400,
          message: "Tüm sorular için bir cevap göndermelisiniz.",
        },
        INVALID_QUESTION: {
          status: 400,
          message: "Gönderilen sorulardan biri bu quiz'e ait değil.",
        },
        INVALID_OPTION: {
          status: 400,
          message: "Seçeneklerden biri ilgili soruya ait değil.",
        },
      } as const;

      const response = responses[result.error];

      return NextResponse.json(
        { success: false, message: response.message },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Quiz başarıyla tamamlandı.",
      result,
    });
  } catch (error) {
    // 16. Transaction çakışması
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "İşlem çakışması oluştu. Lütfen tekrar deneyin.",
        },
        { status: 409 }
      );
    }

    console.error("Quiz submit API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Quiz cevapları kaydedilirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}