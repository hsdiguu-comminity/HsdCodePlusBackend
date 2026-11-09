
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Period = "daily" | "weekly" | "monthly";

// İstanbul saatine göre ilgili dönemin başlangıcını hesaplar.
function getPeriodStart(period: Period, now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  // Türkiye saati UTC+3.
  const today = Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000;

  if (period === "daily") {
    return new Date(today);
  }

  if (period === "weekly") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    return new Date(today - daysSinceMonday * 24 * 60 * 60 * 1000);
  }

  return new Date(
    Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const periodParam = searchParams.get("period") ?? "weekly";
    const communityParam = searchParams.get("communityId");

    if (!["daily", "weekly", "monthly"].includes(periodParam)) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz dönem. daily, weekly veya monthly kullanın.",
        },
        { status: 400 }
      );
    }

    const period = periodParam as Period;

    let communityId: number | null = null;

    if (communityParam !== null) {
      communityId = Number(communityParam);

      if (!Number.isInteger(communityId) || communityId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Geçersiz communityId.",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const startDate = getPeriodStart(period, now);

    const rows = await prisma.$queryRaw<
      Array<{
        userId: number;
        username: string;
        firstName: string;
        lastName: string;
        communityId: number;
        communityName: string;
        totalPoints: bigint;
        eventCount: number;
      }>
    >`
      SELECT
        u.id AS "userId",
        u.username AS "username",
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        u."communityId" AS "communityId",
        c.name AS "communityName",
        SUM(se.points)::bigint AS "totalPoints",
        COUNT(se.id)::int AS "eventCount"
      FROM users u
      INNER JOIN score_events se
        ON se."userId" = u.id
      INNER JOIN hsd_communities c
        ON c.id = u."communityId"
      WHERE
        u.status = 'ACTIVE'
        AND se."createdAt" >= ${startDate}
        AND se."createdAt" <= ${now}
        AND (
          ${communityId}::int IS NULL
          OR u."communityId" = ${communityId}
        )
      GROUP BY
        u.id,
        u.username,
        u."firstName",
        u."lastName",
        u."communityId",
        c.name
      ORDER BY
        SUM(se.points) DESC,
        u.id ASC
      LIMIT 100
    `;

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      communityId: row.communityId,
      communityName: row.communityName,
      totalPoints: Number(row.totalPoints),
      eventCount: row.eventCount,
    }));

    return NextResponse.json({
      success: true,
      period,
      communityId,
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    console.error("Leaderboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Liderlik tablosu alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}