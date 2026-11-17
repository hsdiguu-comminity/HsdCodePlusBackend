import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Errors, handleApiError } from "@/lib/errors";
import { getPointTotals } from "@/services/leaderboard.service";

type Context = { params: Promise<{ username: string }> };

// GET /api/users/[username] — herkese açık profil (e-posta gibi özel bilgiler gönderilmez)
export async function GET(_req: Request, { params }: Context) {
  try {
    const { username } = await params;
    const user = await prisma.user.findFirst({
      // Onay bekleyen ve banlı hesapların profili görünmez
      where: { username: username.toLowerCase(), status: { in: ["ACTIVE", "RESTRICTED"] } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        community: { select: { id: true, name: true, university: true, city: true } },
        profile: { select: { bio: true, avatarUrl: true, githubUrl: true, linkedinUrl: true } },
      },
    });
    if (!user) throw Errors.notFound("Kullanıcı bulunamadı");

    // Kullanıcı id'si yanıtta gönderilmez, yalnızca sorgularda kullanılır
    const { id, ...publicUser } = user;

    const [points, quizzesCompleted, posts] = await Promise.all([
      getPointTotals(id),
      prisma.quizAttempt.count({ where: { userId: id, finishedAt: { not: null } } }),
      prisma.post.findMany({
        where: { authorId: id, status: "APPROVED" },
        orderBy: { publishedAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          publishedAt: true,
          category: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return NextResponse.json({ user: publicUser, points, quizzesCompleted, posts });
  } catch (error) {
    return handleApiError(error);
  }
}
