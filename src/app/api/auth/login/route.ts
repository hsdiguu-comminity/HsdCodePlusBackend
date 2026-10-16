import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";
import { ApiError, handleApiError, readJson } from "@/lib/errors";
import { RateLimits, getClientIp, rateLimit } from "@/lib/rate-limit";
import { findUserByEmail, toPublicUser } from "@/services/user.service";
import { liftExpiredPenalty } from "@/services/admin.service";

const invalidCredentials = () =>
  new ApiError(401, "INVALID_CREDENTIALS", "E-posta veya şifre hatalı");

// POST /api/auth/login — başarılıysa HttpOnly oturum çerezi oluşturur
export async function POST(req: Request) {
  try {
    rateLimit(`login:${getClientIp(req)}`, RateLimits.login);

    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) throw invalidCredentials();
    const { email, password } = parsed.data;

    const found = await findUserByEmail(email);
    if (!found || !(await verifyPassword(found.passwordHash, password))) {
      throw invalidCredentials();
    }

    // Süresi dolmuş ban/kısıtlama varsa önce kaldırılır
    const user = await liftExpiredPenalty(found);

    // Durum mesajları yalnızca şifre doğruysa gösterilir (hesabın varlığı sızdırılmaz)
    if (user.status === "PENDING") {
      throw new ApiError(403, "ACCOUNT_PENDING", "Üyeliğiniz henüz yönetici tarafından onaylanmadı");
    }
    if (user.status === "BANNED") {
      throw new ApiError(403, "ACCOUNT_BANNED", "Hesabınız askıya alınmıştır");
    }

    // Auth.js oturumu açar ve çerezi yanıta ekler
    await signIn("credentials", { email, password, redirect: false });

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof Error && error.name === "CredentialsSignin") {
      return handleApiError(invalidCredentials());
    }
    return handleApiError(error);
  }
}