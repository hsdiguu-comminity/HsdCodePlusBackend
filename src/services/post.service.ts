
import { prisma } from "@/lib/prisma";
import { PostStatus, Prisma } from "@/generated/prisma";

type ListPostsOptions = {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
};

export async function listPublishedPosts(options: ListPostsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 10));

  const where: Prisma.PostWhereInput = {
    status: PostStatus.APPROVED,
    ...(options.category
      ? { category: { slug: options.category } }
      : {}),
    ...(options.q
      ? {
          OR: [
            { title: { contains: options.q, mode: "insensitive" } },
            { contentMd: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
        category: true,
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: PostStatus.APPROVED },
    include: {
      author: {
        select: { id: true, username: true, firstName: true, lastName: true },
      },
      category: true,
      images: true,
    },
  });
}

export async function createPost(data: {
  authorId: string;
  title: string;
  categoryId: string;
  contentMd: string;
  coverUrl?: string;
  slug: string;
}) {
  return prisma.post.create({
    data: {
      authorId: data.authorId,
      title: data.title,
      categoryId: data.categoryId,
      contentMd: data.contentMd,
      coverUrl: data.coverUrl || null,
      slug: data.slug,
      status: PostStatus.PENDING,
    },
  });
}

export async function updatePost(
  postId: string,
  authorId: string,
  data: {
    title?: string;
    categoryId?: string;
    contentMd?: string;
    coverUrl?: string | null;
  },
) {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      authorId,
      status: { in: [PostStatus.PENDING, PostStatus.REJECTED] },
    },
  });

  if (!post) {
    throw new Error("Gönderi bulunamadı veya düzenleme yetkiniz yok.");
  }

  return prisma.post.update({
    where: { id: postId },
    data,
  });
}

export async function deletePost(postId: string, authorId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, authorId },
  });

  if (!post) {
    throw new Error("Gönderi bulunamadı veya silme yetkiniz yok.");
  }

  return prisma.post.delete({ where: { id: postId } });
}
