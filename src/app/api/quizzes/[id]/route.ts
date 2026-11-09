import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçersiz kullanıcı." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Aktif kullanıcı bulunamadı." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const quizId = Number(id);

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçersiz quiz ID." },
        { status: 400 }
      );
    }

    const now = new Date();

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        isPublished: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        timeLimitSec: true,
        startsAt: true,
        endsAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            points: true,
            order: true,
            options: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
        attempts: {
          where: { userId },
          select: {
            id: true,
            score: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz bulunamadı veya erişime açık değil." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quiz: {
        ...quiz,
        questionCount: quiz.questions.length,
        totalPoints: quiz.questions.reduce(
          (total, question) => total + question.points,
          0
        ),
        completedAttempts: quiz.attempts.filter(
          (attempt) => attempt.finishedAt !== null
        ).length,
        hasInProgressAttempt: quiz.attempts.some(
          (attempt) => attempt.finishedAt === null
        ),
      },
    });
  } catch (error) {
    console.error("Quiz detail API error:", error);

    return NextResponse.json(
      { success: false, message: "Quiz detayları alınırken hata oluştu." },
      { status: 500 }
    );
  }
}