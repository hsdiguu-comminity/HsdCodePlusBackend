import { prisma } from "@/lib/prisma";

export type Period = "daily" | "weekly" | "monthly";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000; // Türkiye saati UTC+3 (yaz saati yok)
const DAY_MS = 24 * 60 * 60 * 1000;

// İstanbul saatine göre bugünün, bu haftanın (Pazartesi) ve bu ayın başlangıcı (UTC olarak)
export function getPeriodStarts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const dayStart = Date.UTC(year, month - 1, day) - ISTANBUL_OFFSET_MS;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  return {
    daily: new Date(dayStart),
    weekly: new Date(dayStart - daysSinceMonday * DAY_MS),
    monthly: new Date(Date.UTC(year, month - 1, 1) - ISTANBUL_OFFSET_MS),
  };
}

type LeaderboardRow = {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  communityId: string;
  communityName: string;
  university: string;
  totalPoints: bigint;
};

// Puanlar score_events tablosundan dönem bazlı toplanır (yalnızca aktif üyeler)
export async function getLeaderboard(period: Period, communityId?: string, limit = 50) {
  const since = getPeriodStarts()[period];

  const rows = await prisma.$queryRaw<LeaderboardRow[]>`
    SELECT
      u.id            AS "userId",
      u.username      AS "username",
      u.first_name    AS "firstName",
      u.last_name     AS "lastName",
      c.id            AS "communityId",
      c.name          AS "communityName",
      c.university    AS "university",
      SUM(s.points)::bigint AS "totalPoints"
    FROM score_events s
    JOIN users u ON u.id = s.user_id
    JOIN hsd_communities c ON c.id = u.community_id
    WHERE s.created_at >= ${since}
      AND u.status IN ('ACTIVE', 'RESTRICTED')
      AND (${communityId ?? null}::text IS NULL OR u.community_id = ${communityId ?? null})
    GROUP BY u.id, c.id
    HAVING SUM(s.points) > 0
    ORDER BY SUM(s.points) DESC, MIN(s.created_at) ASC
    LIMIT ${limit}
  `;

  return {
    period,
    since,
    items: rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      community: { id: row.communityId, name: row.communityName, university: row.university },
      points: Number(row.totalPoints),
    })),
  };
}

// Kullanıcının verilen dönemdeki sırası (puanı yoksa null)
export async function getUserRank(userId: string, since: Date) {
  const rows = await prisma.$queryRaw<{ rank: bigint }[]>`
    WITH totals AS (
      SELECT s.user_id, SUM(s.points) AS points, MIN(s.created_at) AS first_at
      FROM score_events s
      JOIN users u ON u.id = s.user_id
      WHERE s.created_at >= ${since} AND u.status IN ('ACTIVE', 'RESTRICTED')
      GROUP BY s.user_id
      HAVING SUM(s.points) > 0
    ),
    ranked AS (
      SELECT user_id, ROW_NUMBER() OVER (ORDER BY points DESC, first_at ASC) AS rank FROM totals
    )
    SELECT rank FROM ranked WHERE user_id = ${userId}
  `;
  return rows[0] ? Number(rows[0].rank) : null;
}

export async function getPointTotals(userId: string) {
  const starts = getPeriodStarts();
  const [total, daily, weekly, monthly] = await Promise.all([
    prisma.scoreEvent.aggregate({ where: { userId }, _sum: { points: true } }),
    prisma.scoreEvent.aggregate({ where: { userId, createdAt: { gte: starts.daily } }, _sum: { points: true } }),
    prisma.scoreEvent.aggregate({ where: { userId, createdAt: { gte: starts.weekly } }, _sum: { points: true } }),
    prisma.scoreEvent.aggregate({ where: { userId, createdAt: { gte: starts.monthly } }, _sum: { points: true } }),
  ]);
  return {
    total: total._sum.points ?? 0,
    daily: daily._sum.points ?? 0,
    weekly: weekly._sum.points ?? 0,
    monthly: monthly._sum.points ?? 0,
  };
}
