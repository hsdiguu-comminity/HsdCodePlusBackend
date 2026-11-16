import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/errors";
import { addScoreEvent } from "@/lib/scoring";
import { AuditActions, logAdminAction } from "@/lib/audit";
import { excerpt, renderMarkdown } from "@/lib/sanitize";
import { slugify } from "@/services/admin.service";
import type { Prisma, PostStatus, User } from "@/generated/prisma/client";
import type { CreatePostInput, PostListQuery, UpdatePostInput } from "@/lib/validations/post";

// Yazı onaylandığında yazara verilen puan
export const POST_APPROVED_POINTS = 20;

const authorSelect = { id: true, username: true, firstName: true, lastName: true } as const;
const categorySelect = { id: true, name: true, slug: true } as const;

// ---------------- Herkese açık ----------------

export async function listPublishedPosts(query: PostListQuery) {
  const where: Prisma.PostWhereInput = {
    status: "APPROVED",
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { contentMd: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { author: { select: authorSelect }, category: { select: categorySelect } },
    }),
  ]);

  return {
    items: posts.map(({ contentMd, ...post }) => ({ ...post, excerpt: excerpt(contentMd) })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function getPublishedPost(slug: string) {
  const post = await prisma.post.findFirst({
    where: { slug, status: "APPROVED" },
    include: {
      author: { select: authorSelect },
      category: { select: categorySelect },
      images: { select: { id: true, url: true } },
    },
  });
  if (!post) throw Errors.notFound("Yazı bulunamadı");

  // contentHtml güvenli HTML'dir; frontend bunu gösterir, contentMd düzenleme içindir
  return { ...post, contentHtml: await renderMarkdown(post.contentMd) };
}

// ---------------- Yazar ----------------

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw Errors.badRequest("Seçilen kategori bulunamadı");
}

function createSlug(title: string) {
  const base = slugify(title).slice(0, 80) || "yazi";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

// Yeni yazı onaya gönderilir (PENDING); admin onaylayınca yayınlanır
export async function createPost(authorId: string, input: CreatePostInput) {
  await assertCategoryExists(input.categoryId);

  return prisma.post.create({
    data: {
      authorId,
      title: input.title,
      categoryId: input.categoryId,
      contentMd: input.contentMd,
      coverUrl: input.coverUrl ?? null,
      slug: createSlug(input.title),
      status: "PENDING",
    },
    include: { category: { select: categorySelect } },
  });
}

// Adres parametresi yazının id'si veya slug'ı olabilir
async function findPostByIdOrSlug(idOrSlug: string) {
  const post = await prisma.post.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
  if (!post) throw Errors.notFound("Yazı bulunamadı");
  return post;
}

const EDITABLE_STATUSES: PostStatus[] = ["DRAFT", "PENDING", "REJECTED"];

// Yazar yalnızca yayınlanmamış yazısını düzenleyebilir; düzenlenen yazı yeniden onaya düşer
export async function updatePost(user: User, idOrSlug: string, input: UpdatePostInput) {
  const post = await findPostByIdOrSlug(idOrSlug);
  if (post.authorId !== user.id) throw Errors.forbidden("Bu yazıyı düzenleme yetkiniz yok");
  if (!EDITABLE_STATUSES.includes(post.status)) {
    throw new ApiError(409, "POST_LOCKED", "Yayınlanmış yazılar düzenlenemez");
  }
  if (input.categoryId) await assertCategoryExists(input.categoryId);

  return prisma.post.update({
    where: { id: post.id },
    data: {
      title: input.title,
      categoryId: input.categoryId,
      contentMd: input.contentMd,
      coverUrl: input.coverUrl,
      status: "PENDING",
      rejectReason: null,
    },
    include: { category: { select: categorySelect } },
  });
}

// Yazar kendi yazısını, admin her yazıyı silebilir
export async function deletePost(user: User, idOrSlug: string) {
  const post = await findPostByIdOrSlug(idOrSlug);
  if (post.authorId !== user.id && user.role !== "ADMIN") {
    throw Errors.forbidden("Bu yazıyı silme yetkiniz yok");
  }
  await prisma.post.delete({ where: { id: post.id } });
}

// ---------------- Admin ----------------

export async function listPostsForAdmin(status: PostStatus, page: number, pageSize: number) {
  const where: Prisma.PostWhereInput = { status };
  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      // Onay bekleyenler en eskiden başlayarak sıralanır (sırayla incelensin diye)
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { author: { select: authorSelect }, category: { select: categorySelect } },
    }),
  ]);

  // Admin incelerken içeriği görebilsin diye güvenli HTML de eklenir
  const items = await Promise.all(
    posts.map(async (post) => ({ ...post, contentHtml: await renderMarkdown(post.contentMd) }))
  );
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function approvePost(adminId: string, postId: string) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Yalnızca hâlâ bekleyen yazı onaylanır (iki admin aynı anda onaylarsa puan bir kez verilir)
    const { count } = await tx.post.updateMany({
      where: { id: postId, status: "PENDING" },
      data: { status: "APPROVED", publishedAt: now, rejectReason: null },
    });
    if (count === 0) {
      const exists = await tx.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!exists) throw Errors.notFound("Yazı bulunamadı");
      throw new ApiError(409, "NOT_PENDING", "Bu yazı onay beklemiyor");
    }

    const post = await tx.post.findUniqueOrThrow({ where: { id: postId } });
    await addScoreEvent(
      { userId: post.authorId, points: POST_APPROVED_POINTS, source: "POST_APPROVED", refId: post.id },
      tx
    );
    await logAdminAction(
      { adminId, action: AuditActions.POST_APPROVE, targetType: "POST", targetId: post.id },
      tx
    );
    return post;
  });
}

export async function rejectPost(adminId: string, postId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.post.updateMany({
      where: { id: postId, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: reason },
    });
    if (count === 0) {
      const exists = await tx.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!exists) throw Errors.notFound("Yazı bulunamadı");
      throw new ApiError(409, "NOT_PENDING", "Yalnızca onay bekleyen yazılar reddedilebilir");
    }

    await logAdminAction(
      { adminId, action: AuditActions.POST_REJECT, targetType: "POST", targetId: postId },
      tx
    );
    return tx.post.findUniqueOrThrow({ where: { id: postId } });
  });
}
