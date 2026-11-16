import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, readJson } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { hashPassword, verifyPassword } from "@/lib/password";
import { RateLimits, rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/user";

// POST /api/users/me/password — { currentPassword, newPassword }
export async function POST(req: Request) {
  try {
    const user = await requireUser({ allowRestricted: true });
    // Mevcut şifreyi tahmin etmeye karşı hesap başına giriş ile aynı sınır uygulanır
    rateLimit(`change-password:${user.id}`, RateLimits.login);

    const { currentPassword, newPassword } = changePasswordSchema.parse(await readJson(req));

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new ApiError(400, "WRONG_PASSWORD", "Mevcut şifreniz hatalı");
    }
    if (await verifyPassword(user.passwordHash, newPassword)) {
      throw new ApiError(400, "SAME_PASSWORD", "Yeni şifre eskisiyle aynı olamaz");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return NextResponse.json({ message: "Şifreniz değiştirildi" });
  } catch (error) {
    return handleApiError(error);
  }
}
