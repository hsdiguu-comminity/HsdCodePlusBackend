import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { submitQuizSchema } from "@/lib/validations/quiz";
import { submitQuiz } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/quizzes/[id]/submit — { answers: [{ questionId, optionId }] }
// Puan sunucuda hesaplanır; süre sunucuda kontrol edilir.
export async function POST(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireUser({ allowRestricted: true });
    const input = submitQuizSchema.parse(await readJson(req));
    const result = await submitQuiz(user.id, id, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
