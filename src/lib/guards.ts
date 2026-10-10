import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

type RequireUserOptions = {
  // Kısıtlanmış (RESTRICTED) kullanıcıların da geçmesine izin verilsin mi?
  // Varsayılan: hayır — yazı gönderme gibi işlemler yalnızca ACTIVE üyelere açıktır.
  allowRestricted?: boolean;
};

// Oturumdaki kullanıcıyı veritabanından okur ve durumunu kontrol eder.
// Rol ve durum her istekte veritabanından alınır; böylece banlanan bir kullanıcının
// eski oturumu anında geçersiz olur.
export async function requireUser(options: RequireUserOptions = {}) {
  const session = await auth();
  if (!session?.user?.id) throw Errors.unauthorized();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw Errors.unauthorized();

  if (user.status === "BANNED") throw Errors.forbidden("Hesabınız askıya alınmıştır");
  if (user.status === "PENDING") {
    throw Errors.forbidden("Üyeliğiniz henüz yönetici tarafından onaylanmadı");
  }
  if (user.status === "RESTRICTED" && !options.allowRestricted) {
    throw Errors.forbidden("Hesabınız kısıtlanmıştır, bu işlemi yapamazsınız");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser({ allowRestricted: true });
  if (user.role !== "ADMIN") throw Errors.forbidden();
  return user;
}

// Giriş zorunlu olmayan sayfalarda oturum varsa kullanıcıyı, yoksa null döner
export async function getOptionalUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}