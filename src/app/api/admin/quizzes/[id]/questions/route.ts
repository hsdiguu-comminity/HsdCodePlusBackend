import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { questionSchema } from "@/lib/validations/quiz";
import { createQuestion, listQuestions } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// GET /api/admin/quizzes/[id]/questions
export async function GET(_req: Request, { params }: Context) {
  try {
    await requireAdmin();
    const { id } = await params;
    const questions = await listQuestions(id);
    return NextResponse.json({ questions });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/admin/quizzes/[id]/questions
// { text, points?, order?, options: [{ text, isCorrect }] } — tam olarak bir doğru şık
export async function POST(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = questionSchema.parse(await readJson(req));
    const question = await createQuestion(admin.id, id, input);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
