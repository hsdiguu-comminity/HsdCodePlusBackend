import { prisma } from "@/lib/prisma";
import type { Prisma, ScoreSource } from "@/generated/prisma/client";

// Puan her zaman bu fonksiyonla eklenir (leaderboard score_events tablosundan hesaplanır).
// Quiz puanı (Eren) ve yazı onay puanı (İrem) aynı fonksiyonu kullanır.
// Transaction içinde çağrılacaksa ikinci parametre olarak tx verilir.
export function addScoreEvent(
  data: { userId: string; points: number; source: ScoreSource; refId?: string },
  db: Prisma.TransactionClient = prisma
) {
  return db.scoreEvent.create({
    data: {
      userId: data.userId,
      points: data.points,
      source: data.source,
      refId: data.refId ?? null,
    },
  });
}

type GradableQuestion = {
  id: string;
  points: number;
  options: { id: string; isCorrect: boolean }[];
};

// Cevapları sunucuda puanlar. Geçersiz (başka soruya ait) şıklar ve aynı soruya
// gelen ikinci cevaplar dikkate alınmaz.
export function gradeAnswers(
  questions: GradableQuestion[],
  answers: { questionId: string; optionId: string }[]
) {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const accepted = new Map<string, string>(); // questionId -> optionId

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question || accepted.has(answer.questionId)) continue;
    if (!question.options.some((o) => o.id === answer.optionId)) continue;
    accepted.set(answer.questionId, answer.optionId);
  }

  let score = 0;
  let correctCount = 0;
  const results = questions.map((question) => {
    const optionId = accepted.get(question.id) ?? null;
    const isCorrect =
      optionId !== null && question.options.some((o) => o.id === optionId && o.isCorrect);
    if (isCorrect) {
      score += question.points;
      correctCount++;
    }
    return { questionId: question.id, optionId, isCorrect };
  });

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  return { score, totalPoints, correctCount, results, accepted };
}
