import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { updateQuizSchema } from "@/lib/validations/quiz";
import { deleteQuiz, getQuizForAdmin, updateQuiz } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// GET /api/admin/quizzes/[id] — soru ve şıklarıyla (doğru cevaplar dahil)
export async function GET(_req: Request, { params }: Context) {
  try {
    await requireAdmin();
    const { id } = await params;
    const quiz = await getQuizForAdmin(id);
    return NextResponse.json({ quiz });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/admin/quizzes/[id] — düzenleme; { isPublished: true } ile yayınlama
export async function PATCH(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = updateQuizSchema.parse(await readJson(req));
    const quiz = await updateQuiz(admin.id, id, input);
    return NextResponse.json({ quiz });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/admin/quizzes/[id] — yalnızca hiç çözülmemiş quizler silinebilir
export async function DELETE(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await deleteQuiz(admin.id, id);
    return NextResponse.json({ message: "Quiz silindi" });
  } catch (error) {
    return handleApiError(error);
  }
}
