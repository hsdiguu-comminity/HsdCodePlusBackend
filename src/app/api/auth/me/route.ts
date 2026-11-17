import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/errors";
import { toPublicUser } from "@/services/user.service";

// GET /api/auth/me — oturumdaki kullanıcı ve topluluğu (giriş yoksa 401)
export async function GET() {
  try {
    const user = await requireUser({ allowRestricted: true });
    const community = await prisma.hsdCommunity.findUnique({
      where: { id: user.communityId },
      select: { id: true, name: true, university: true, city: true },
    });
    return NextResponse.json({ user: { ...toPublicUser(user), community } });
  } catch (error) {
    return handleApiError(error);
  }
}
