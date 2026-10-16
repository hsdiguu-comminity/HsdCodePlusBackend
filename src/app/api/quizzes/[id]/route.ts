import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getOptionalUser } from "@/lib/guards";
import { getPublishedQuiz } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// GET /api/quizzes/[id] — quiz bilgisi (sorular ve doğru cevaplar gönderilmez)
export async function GET(_req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await getOptionalUser();
    const quiz = await getPublishedQuiz(id, user?.id);
    return NextResponse.json({ quiz });
  } catch (error) {
    return handleApiError(error);
  }
}
