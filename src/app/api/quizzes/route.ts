import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { quizListQuerySchema } from "@/lib/validations/quiz";
import { listPublishedQuizzes } from "@/services/quiz.service";

// GET /api/quizzes?category=web — yayındaki quizler (herkese açık)
export async function GET(req: Request) {
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { category } = quizListQuerySchema.parse(params);
    const quizzes = await listPublishedQuizzes(category);
    return NextResponse.json({ quizzes });
  } catch (error) {
    return handleApiError(error);
  }
}
