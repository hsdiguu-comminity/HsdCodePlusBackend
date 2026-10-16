import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { startQuiz } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/quizzes/[id]/start — denemeyi başlatır, soruları (doğru cevaplar olmadan) döner.
// Kısıtlanmış üyeler quiz çözebilir (kısıtlama yalnızca paylaşım yapmayı engeller).
export async function POST(_req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireUser({ allowRestricted: true });
    const attempt = await startQuiz(user.id, id);
    return NextResponse.json(attempt);
  } catch (error) {
    return handleApiError(error);
  }
}
