import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ApiError, handleApiError, readJson } from "@/lib/errors";
import { RateLimits, getClientIp, rateLimit } from "@/lib/rate-limit";

const invalidToken = () =>
  new ApiError(400, "INVALID_TOKEN", "Bağlantı geçersiz veya süresi dolmuş, lütfen yeniden isteyin");

// POST /api/auth/reset-password — { token, password }
export async function POST(req: Request) {
  try {
    rateLimit(`reset-password:${getClientIp(req)}`, RateLimits.resetPassword);

    const { token, password } = resetPasswordSchema.parse(await readJson(req));
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw invalidToken();
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      // Token yalnızca hâlâ kullanılmamışsa işaretlenir (aynı anda iki istek gelirse biri başarısız olur)
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) throw invalidToken();

      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    });

    return NextResponse.json({ message: "Şifreniz güncellendi, yeni şifrenizle giriş yapabilirsiniz" });
  } catch (error) {
    return handleApiError(error);
  }
}