import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

// GET /api/communities — kayıt formundaki HSD topluluk listesi (herkese açık)
export async function GET() {
  try {
    const communities = await prisma.hsdCommunity.findMany({
      orderBy: [{ city: "asc" }, { university: "asc" }],
      select: { id: true, name: true, university: true, city: true },
    });
    return NextResponse.json({ communities });
  } catch (error) {
    return handleApiError(error);
  }
}
