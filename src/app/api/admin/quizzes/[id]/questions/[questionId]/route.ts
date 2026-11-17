import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { questionSchema } from "@/lib/validations/quiz";
import { deleteQuestion, updateQuestion } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string; questionId: string }> };

// PATCH /api/admin/quizzes/[id]/questions/[questionId] — soru ve şıkları tamamen yeniler
export async function PATCH(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id, questionId } = await params;
    const input = questionSchema.parse(await readJson(req));
    const question = await updateQuestion(admin.id, id, questionId, input);
    return NextResponse.json({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/admin/quizzes/[id]/questions/[questionId]
export async function DELETE(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id, questionId } = await params;
    await deleteQuestion(admin.id, id, questionId);
    return NextResponse.json({ message: "Soru silindi" });
  } catch (error) {
    return handleApiError(error);
  }
}
