import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { handleApiError, readJson } from "@/lib/errors";
import { RateLimits, getClientIp, rateLimit } from "@/lib/rate-limit";
import { findUserByEmail } from "@/services/user.service";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 dakika

// POST /api/auth/forgot-password — { email }
// Kullanıcı olsa da olmasa da aynı yanıt döner (hangi e-postaların kayıtlı olduğu sızdırılmaz)
export async function POST(req: Request) {
  try {
    rateLimit(`forgot-password:${getClientIp(req)}`, RateLimits.forgotPassword);

    const { email } = forgotPasswordSchema.parse(await readJson(req));
    const user = await findUserByEmail(email);

    if (user && user.status !== "BANNED") {
      // 32 baytlık rastgele token; veritabanında yalnızca SHA-256 hash'i tutulur
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      await prisma.$transaction([
        // Önceki kullanılmamış bağlantılar geçersiz olur
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
        }),
      ]);

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";
      const resetUrl = `${frontendUrl}/sifre-sifirla?token=${encodeURIComponent(token)}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailError) {
        console.error("Şifre sıfırlama e-postası gönderilemedi:", mailError);
      }
    }

    return NextResponse.json({
      message: "Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi",
    });
  } catch (error) {
    return handleApiError(error);
  }
}