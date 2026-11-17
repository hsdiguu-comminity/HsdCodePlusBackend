import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { getAttemptResult } from "@/services/quiz.service";

type Context = { params: Promise<{ id: string }> };

// GET /api/quizzes/[id]/result — kullanıcının tamamladığı denemenin sonucu
// (doğru cevaplar ve açıklamalar yalnızca deneme bittikten sonra, yalnızca sahibine gösterilir)
export async function GET(_req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireUser({ allowRestricted: true });
    return NextResponse.json(await getAttemptResult(user.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
