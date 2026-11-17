import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/errors";
import { AuditActions, logAdminAction } from "@/lib/audit";
import { sendAccountApprovedEmail } from "@/lib/mail";
import { Prisma, type User } from "@/generated/prisma/client";
import { toPublicUser } from "@/services/user.service";
import type { z } from "zod";
import type {
  banSchema,
  categorySchema,
  restrictSchema,
  updateCategorySchema,
  userListQuerySchema,
} from "@/lib/validations/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------- Süreli cezaların otomatik bitmesi ----------------

// Kısıtlama/ban süresi dolmuşsa kullanıcıyı tekrar ACTIVE yapar ve güncel kullanıcıyı döner.
// Yalnızca süreli bir ceza kaydı olan ve süresi geçmiş kullanıcılar etkilenir;
// kalıcı banlar (expiresAt boş) asla kendiliğinden kalkmaz.
export async function liftExpiredPenalty(user: User): Promise<User> {
  if (user.status !== "RESTRICTED" && user.status !== "BANNED") return user;

  const latest = await prisma.ban.findFirst({
    where: { userId: user.id, type: user.status === "BANNED" ? "BAN" : "RESTRICT" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest?.expiresAt || latest.expiresAt > new Date()) return user;

  // Son ceza admin tarafından elle kaldırıldıysa (unban), kullanıcının şu anki cezası
  // o kayıttan gelmiyordur — kendiliğinden kaldırılmaz
  const liftedByAdmin = await prisma.auditLog.count({
    where: {
      action: AuditActions.USER_UNBAN,
      targetId: user.id,
      createdAt: { gte: latest.createdAt },
    },
  });
  if (liftedByAdmin > 0) return user;

  const { count } = await prisma.user.updateMany({
    where: { id: user.id, status: user.status },
    data: { status: "ACTIVE" },
  });
  return count > 0 ? { ...user, status: "ACTIVE" } : user;
}

// ---------------- Üyeler ----------------

export async function listUsers(query: z.infer<typeof userListQuerySchema>) {
  const where: Prisma.UserWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" } },
            { username: { contains: query.q, mode: "insensitive" } },
            { firstName: { contains: query.q, mode: "insensitive" } },
            { lastName: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { community: { select: { id: true, name: true, university: true } } },
    }),
  ]);

  return {
    items: users.map((user) => ({ ...toPublicUser(user), community: user.community })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

async function findTargetUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound("Kullanıcı bulunamadı");
  return user;
}

// Admin kendine veya başka bir admine ceza veremez
function assertCanPunish(admin: User, target: User) {
  if (admin.id === target.id) throw Errors.badRequest("Kendinize bu işlemi uygulayamazsınız");
  if (target.role === "ADMIN") throw Errors.forbidden("Yöneticilere bu işlem uygulanamaz");
}

export async function approveUser(adminId: string, userId: string) {
  const target = await findTargetUser(userId);
  if (target.status !== "PENDING") {
    throw new ApiError(409, "NOT_PENDING", "Bu kullanıcı onay beklemiyor");
  }

  const user = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: "PENDING" },
      data: { status: "ACTIVE" },
    });
    if (count === 0) throw new ApiError(409, "NOT_PENDING", "Bu kullanıcı onay beklemiyor");
    await logAdminAction(
      { adminId, action: AuditActions.USER_APPROVE, targetType: "USER", targetId: userId },
      tx
    );
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  });

  try {
    await sendAccountApprovedEmail(user.email, user.firstName);
  } catch (mailError) {
    console.error("Onay e-postası gönderilemedi:", mailError);
  }

  return toPublicUser(user);
}

// Onay bekleyen başvuru reddedilir ve silinir (aynı e-postayla yeniden kayıt olunabilir)
export async function rejectUser(adminId: string, userId: string) {
  const target = await findTargetUser(userId);
  if (target.status !== "PENDING") {
    throw new ApiError(409, "NOT_PENDING", "Yalnızca onay bekleyen başvurular reddedilebilir");
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.deleteMany({ where: { id: userId, status: "PENDING" } });
    if (count === 0) {
      throw new ApiError(409, "NOT_PENDING", "Yalnızca onay bekleyen başvurular reddedilebilir");
    }
    await logAdminAction(
      { adminId, action: AuditActions.USER_REJECT, targetType: "USER", targetId: userId },
      tx
    );
  });
}

export async function restrictUser(
  admin: User,
  userId: string,
  input: z.infer<typeof restrictSchema>
) {
  const target = await findTargetUser(userId);
  assertCanPunish(admin, target);
  if (target.status !== "ACTIVE" && target.status !== "RESTRICTED") {
    throw new ApiError(409, "INVALID_STATUS", "Yalnızca aktif üyeler kısıtlanabilir");
  }

  const expiresAt = new Date(Date.now() + input.days * DAY_MS);

  const user = await prisma.$transaction(async (tx) => {
    await tx.ban.create({
      data: { userId, type: "RESTRICT", reason: input.reason, adminId: admin.id, expiresAt },
    });
    const updated = await tx.user.update({ where: { id: userId }, data: { status: "RESTRICTED" } });
    await logAdminAction(
      { adminId: admin.id, action: AuditActions.USER_RESTRICT, targetType: "USER", targetId: userId },
      tx
    );
    return updated;
  });

  return { user: toPublicUser(user), expiresAt };
}

export async function banUser(admin: User, userId: string, input: z.infer<typeof banSchema>) {
  const target = await findTargetUser(userId);
  assertCanPunish(admin, target);
  if (target.status === "PENDING") {
    throw new ApiError(409, "INVALID_STATUS", "Onay bekleyen başvurular banlanamaz, reddedilmeli");
  }
  if (target.status === "BANNED") {
    throw new ApiError(409, "ALREADY_BANNED", "Bu kullanıcı zaten banlı");
  }

  const expiresAt = input.days ? new Date(Date.now() + input.days * DAY_MS) : null;

  const user = await prisma.$transaction(async (tx) => {
    await tx.ban.create({
      data: { userId, type: "BAN", reason: input.reason, adminId: admin.id, expiresAt },
    });
    const updated = await tx.user.update({ where: { id: userId }, data: { status: "BANNED" } });
    await logAdminAction(
      { adminId: admin.id, action: AuditActions.USER_BAN, targetType: "USER", targetId: userId },
      tx
    );
    return updated;
  });

  return { user: toPublicUser(user), expiresAt };
}

// Hem ban hem kısıtlamayı kaldırır
export async function unbanUser(adminId: string, userId: string) {
  const target = await findTargetUser(userId);
  if (target.status !== "BANNED" && target.status !== "RESTRICTED") {
    throw new ApiError(409, "NOT_PUNISHED", "Bu kullanıcının aktif bir cezası yok");
  }

  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    // Devam eden ceza kayıtları şu an itibarıyla sona erdirilir (geçmiş korunur)
    await tx.ban.updateMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { expiresAt: now },
    });
    const updated = await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await logAdminAction(
      { adminId, action: AuditActions.USER_UNBAN, targetType: "USER", targetId: userId },
      tx
    );
    return updated;
  });

  return toPublicUser(user);
}

// ---------------- İşlem geçmişi ----------------

export async function listAuditLogs(page: number, pageSize: number) {
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { id: true, username: true, firstName: true, lastName: true } } },
    }),
  ]);
  return { items: logs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

// ---------------- Kategoriler ----------------

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

export function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) => TR_MAP[ch])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true, quizzes: true } } },
  });
}

function categoryConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCategory(adminId: string, input: z.infer<typeof categorySchema>) {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw Errors.badRequest("Geçerli bir kategori adı girin");

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data: { name: input.name, slug } });
      await logAdminAction(
        { adminId, action: AuditActions.CATEGORY_CREATE, targetType: "CATEGORY", targetId: category.id },
        tx
      );
      return category;
    });
  } catch (error) {
    if (categoryConflict(error)) throw Errors.conflict("Bu isimde veya slug ile bir kategori zaten var");
    throw error;
  }
}

export async function updateCategory(
  adminId: string,
  categoryId: string,
  input: z.infer<typeof updateCategorySchema>
) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw Errors.notFound("Kategori bulunamadı");

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: categoryId },
        data: { name: input.name, slug: input.slug },
      });
      await logAdminAction(
        { adminId, action: AuditActions.CATEGORY_UPDATE, targetType: "CATEGORY", targetId: categoryId },
        tx
      );
      return category;
    });
  } catch (error) {
    if (categoryConflict(error)) throw Errors.conflict("Bu isimde veya slug ile bir kategori zaten var");
    throw error;
  }
}

export async function deleteCategory(adminId: string, categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { posts: true, quizzes: true } } },
  });
  if (!category) throw Errors.notFound("Kategori bulunamadı");
  if (category._count.posts > 0 || category._count.quizzes > 0) {
    throw new ApiError(
      409,
      "CATEGORY_IN_USE",
      "Bu kategoride yazı veya quiz olduğu için silinemez"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id: categoryId } });
    await logAdminAction(
      { adminId, action: AuditActions.CATEGORY_DELETE, targetType: "CATEGORY", targetId: categoryId },
      tx
    );
  });
}
