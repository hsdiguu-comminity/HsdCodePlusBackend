import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/auth";
import { Errors, handleApiError, readJson } from "@/lib/errors";
import { RateLimits, getClientIp, rateLimit } from "@/lib/rate-limit";
import { toPublicUser } from "@/services/user.service";

// POST /api/auth/register — kullanıcı PENDING durumunda oluşur, admin onayı bekler
export async function POST(req: Request) {
  try {
    rateLimit(`register:${getClientIp(req)}`, RateLimits.register);

    const { password, ...data } = registerSchema.parse(await readJson(req));

    const community = await prisma.hsdCommunity.findUnique({ where: { id: data.communityId } });
    if (!community) throw Errors.badRequest("Seçilen HSD topluluğu bulunamadı");

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
      select: { email: true },
    });
    if (existing) {
      throw Errors.conflict(
        existing.email === data.email
          ? "Bu e-posta adresi zaten kayıtlı"
          : "Bu kullanıcı adı zaten alınmış"
      );
    }

    const user = await prisma.user.create({
      data: {
        ...data,
        passwordHash: await hashPassword(password),
        status: "PENDING",
        role: "MEMBER",
      },
    });

    return NextResponse.json(
      {
        user: toPublicUser(user),
        message: "Kaydınız alındı, yönetici onayından sonra giriş yapabilirsiniz",
      },
      { status: 201 }
    );
  } catch (error) {
    // Aynı anda iki kayıt isteği gelirse veritabanının unique kuralı yakalar
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return handleApiError(Errors.conflict("Bu e-posta veya kullanıcı adı zaten kayıtlı"));
    }
    return handleApiError(error);
  }
}