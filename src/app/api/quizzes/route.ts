import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
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

    const now = new Date();

    const quizzes = await prisma.quiz.findMany({
      where: {
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
        _count: {
          select: {
            questions: true,
            attempts: true,
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
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      success: true,
      count: quizzes.length,
      quizzes: quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimitSec: quiz.timeLimitSec,
        startsAt: quiz.startsAt,
        endsAt: quiz.endsAt,
        category: quiz.category,
        questionCount: quiz._count.questions,
        totalAttempts: quiz._count.attempts,
        myAttempts: quiz.attempts,
        completedAttempts: quiz.attempts.filter(
          (attempt) => attempt.finishedAt !== null
        ).length,
        hasInProgressAttempt: quiz.attempts.some(
          (attempt) => attempt.finishedAt === null
        ),
      })),
    });
  } catch (error) {
    console.error("Quiz list API error:", error);

    return NextResponse.json(
      { success: false, message: "Quizler alınırken bir hata oluştu." },
      { status: 500 }
    );
  }
}