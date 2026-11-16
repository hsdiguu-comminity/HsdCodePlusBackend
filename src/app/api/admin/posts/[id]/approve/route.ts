
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus, ScoreSource } from "@/generated/prisma";
import { requireAdmin } from "@/lib/guards";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin();

    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id },
      });

      if (!post) {
        throw new Error("POST_NOT_FOUND");
      }

      if (post.status !== PostStatus.PENDING) {
        throw new Error("POST_NOT_PENDING");
      }

      const approvedPost = await tx.post.update({
        where: { id },
        data: {
          status: PostStatus.APPROVED,
          publishedAt: new Date(),
        },
      });

      return approvedPost;
    });

    return NextResponse.json({
      message: "Gönderi onaylandı.",
      post: result,
      scoreAwarded: false,
      note: "Puan miktarı ekip kuralı doğrulandıktan sonra eklenmelidir.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "POST_NOT_FOUND") {
      return NextResponse.json(
        { error: "Gönderi bulunamadı." },
        { status: 404 },
      );
    }

    if (message === "POST_NOT_PENDING") {
      return NextResponse.json(
        { error: "Bu gönderi bekleyen durumda değil." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Yönetici yetkisi gerekli veya onaylama başarısız." },
      { status: 403 },
    );
  }
}
