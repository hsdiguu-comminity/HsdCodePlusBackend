import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { handleApiError } from "@/lib/errors";
import { toPublicUser } from "@/services/user.service";

// GET /api/auth/me — oturumdaki kullanıcı (giriş yoksa 401)
export async function GET() {
  try {
    const user = await requireUser({ allowRestricted: true });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}