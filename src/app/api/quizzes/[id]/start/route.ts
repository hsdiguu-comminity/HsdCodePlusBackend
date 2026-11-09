import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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
        timeLimitSec: true,
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
      },
    });

    if (!quiz) {
      return NextResponse.json(
        {
          success: false,
          message: "Quiz bulunamadı veya erişime açık değil.",
        },
        { status: 404 }
      );
    }

    if (quiz.questions.length === 0) {
      return NextResponse.json(
        { success: false, message: "Bu quiz henüz soru içermiyor." },
        { status: 400 }
      );
    }

    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        quizId,
        finishedAt: null,
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
      },
    });

    if (existingAttempt) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu quiz için devam eden bir denemeniz var.",
          attempt: existingAttempt,
        },
        { status: 409 }
      );
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score: 0,
      },
      select: {
        id: true,
        score: true,
        startedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Quiz başarıyla başlatıldı.",
        attempt,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          timeLimitSec: quiz.timeLimitSec,
          questions: quiz.questions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu quiz için devam eden bir denemeniz zaten var.",
        },
        { status: 409 }
      );
    }

    console.error("Quiz start API error:", error);

    return NextResponse.json(
      { success: false, message: "Quiz başlatılırken hata oluştu." },
      { status: 500 }
    );
  }
}