import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { leaderboardQuerySchema } from "@/lib/validations/user";
import { getLeaderboard } from "@/services/leaderboard.service";

// GET /api/leaderboard?period=daily|weekly|monthly&community=<topluluk id>&limit=50 — herkese açık
export async function GET(req: Request) {
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { period, community, limit } = leaderboardQuerySchema.parse(params);
    return NextResponse.json(await getLeaderboard(period, community, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
