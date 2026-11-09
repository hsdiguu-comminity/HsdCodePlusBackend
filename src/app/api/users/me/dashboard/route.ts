import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ISTANBUL_OFFSET_HOURS = 3;

function getIstanbulPeriods() {
  const now = new Date();

  // İstanbul takvim tarihini UTC parçalarıyla alıyoruz.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const toUtc = (y: number, m: number, d: number) =>
    new Date(
      Date.UTC(y, m - 1, d, -ISTANBUL_OFFSET_HOURS)
    );

  return {
    dayStart: toUtc(year, month, day),
    weekStart: toUtc(year, month, day - daysSinceMonday),
    monthStart: toUtc(year, month, 1),
  };
}

async function getRank(userId: number, startDate: Date) {
  const rankings = await prisma.scoreEvent.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      user: { status: "ACTIVE" },
    },
    _sum: { points: true },
    orderBy: [
      { _sum: { points: "desc" } },
      { userId: "asc" },
    ],
  });

  const index = rankings.findIndex((item) => item.userId === userId);

  return index === -1 ? null : index + 1;
}

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
        { success: false, message: "Geçersiz kullanıcı bilgisi." },
        { status: 401 }
      );
    }

    const { dayStart, weekStart, monthStart } =
      getIstanbulPeriods();

    const [
      user,
      totalPoints,
      dailyPoints,
      weeklyPoints,
      monthlyPoints,
      quizStats,
      postStats,
      dailyRank,
      weeklyRank,
      monthlyRank,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          status: true,
          community: {
            select: {
              id: true,
              name: true,
              university: true,
              city: true,
            },
          },
          profile: {
            select: {
              bio: true,
              avatarUrl: true,
              githubUrl: true,
              linkedinUrl: true,
            },
          },
        },
      }),

      prisma.scoreEvent.aggregate({
        where: { userId },
        _sum: { points: true },
      }),

      prisma.scoreEvent.aggregate({
        where: { userId, createdAt: { gte: dayStart } },
        _sum: { points: true },
      }),

      prisma.scoreEvent.aggregate({
        where: { userId, createdAt: { gte: weekStart } },
        _sum: { points: true },
      }),

      prisma.scoreEvent.aggregate({
        where: { userId, createdAt: { gte: monthStart } },
        _sum: { points: true },
      }),

      prisma.quizAttempt.aggregate({
        where: {
          userId,
          finishedAt: { not: null },
        },
        _count: { _all: true },
        _avg: { score: true },
        _max: { score: true },
      }),

      prisma.post.groupBy({
        by: ["status"],
        where: { authorId: userId },
        _count: { _all: true },
      }),

      getRank(userId, dayStart),
      getRank(userId, weekStart),
      getRank(userId, monthStart),
    ]);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 404 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Hesap aktif değil." },
        { status: 403 }
      );
    }

    const posts = {
      total: postStats.reduce(
        (sum, item) => sum + item._count._all,
        0
      ),
      approved:
        postStats.find((item) => item.status === "APPROVED")
          ?._count._all ?? 0,
      pending:
        postStats.find((item) => item.status === "PENDING")
          ?._count._all ?? 0,
      rejected:
        postStats.find((item) => item.status === "REJECTED")
          ?._count._all ?? 0,
      draft:
        postStats.find((item) => item.status === "DRAFT")
          ?._count._all ?? 0,
    };

    return NextResponse.json({
      success: true,
      dashboard: {
        user,
        points: {
          total: totalPoints._sum.points ?? 0,
          daily: dailyPoints._sum.points ?? 0,
          weekly: weeklyPoints._sum.points ?? 0,
          monthly: monthlyPoints._sum.points ?? 0,
        },
        quizzes: {
          completed: quizStats._count._all,
          averageScore: quizStats._avg.score ?? 0,
          highestScore: quizStats._max.score ?? 0,
        },
        posts,
        rankings: {
          daily: dailyRank,
          weekly: weeklyRank,
          monthly: monthlyRank,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Dashboard bilgileri alınamadı.",
      },
      { status: 500 }
    );
  }
}