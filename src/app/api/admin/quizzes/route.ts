import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { createQuizSchema } from "@/lib/validations/quiz";
import { createQuiz, listAllQuizzes } from "@/services/quiz.service";

// GET /api/admin/quizzes — taslaklar dahil tüm quizler
export async function GET() {
  try {
    await requireAdmin();
    const quizzes = await listAllQuizzes();
    return NextResponse.json({ quizzes });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/admin/quizzes — yeni quiz (taslak olarak oluşur, sonra PATCH ile yayınlanır)
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const input = createQuizSchema.parse(await readJson(req));
    const quiz = await createQuiz(admin.id, input);
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
