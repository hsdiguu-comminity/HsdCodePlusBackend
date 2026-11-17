import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { toPublicUser } from "@/services/user.service";
import { getPeriodStarts, getPointTotals, getUserRank } from "@/services/leaderboard.service";

// GET /api/users/me/dashboard — puanlar, sıralar, quiz geçmişi ve yazıların durumu
export async function GET() {
  try {
    const user = await requireUser({ allowRestricted: true });
    const starts = getPeriodStarts();

    const [points, dailyRank, weeklyRank, monthlyRank, community, profile, quizStats, attempts, postCounts, posts] =
      await Promise.all([
        getPointTotals(user.id),
        getUserRank(user.id, starts.daily),
        getUserRank(user.id, starts.weekly),
        getUserRank(user.id, starts.monthly),
        prisma.hsdCommunity.findUnique({ where: { id: user.communityId } }),
        prisma.profile.findUnique({ where: { userId: user.id } }),
        prisma.quizAttempt.aggregate({
          where: { userId: user.id, finishedAt: { not: null } },
          _count: { _all: true },
          _avg: { score: true },
          _max: { score: true },
        }),
        prisma.quizAttempt.findMany({
          where: { userId: user.id, finishedAt: { not: null } },
          orderBy: { finishedAt: "desc" },
          take: 10,
          select: {
            score: true,
            finishedAt: true,
            quiz: { select: { id: true, title: true, category: { select: { name: true, slug: true } } } },
          },
        }),
        prisma.post.groupBy({ by: ["status"], where: { authorId: user.id }, _count: { _all: true } }),
        prisma.post.findMany({
          where: { authorId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            rejectReason: true,
            publishedAt: true,
            createdAt: true,
            category: { select: { name: true, slug: true } },
          },
        }),
      ]);

    const countOf = (status: string) => postCounts.find((row) => row.status === status)?._count._all ?? 0;

    return NextResponse.json({
      user: { ...toPublicUser(user), community, profile },
      points,
      rankings: { daily: dailyRank, weekly: weeklyRank, monthly: monthlyRank },
      quizzes: {
        completed: quizStats._count._all,
        averageScore: Math.round(quizStats._avg.score ?? 0),
        highestScore: quizStats._max.score ?? 0,
        recent: attempts,
      },
      posts: {
        total: postCounts.reduce((sum, row) => sum + row._count._all, 0),
        approved: countOf("APPROVED"),
        pending: countOf("PENDING"),
        rejected: countOf("REJECTED"),
        recent: posts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
