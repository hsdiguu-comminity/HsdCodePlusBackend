
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@/generated/prisma";
import { requireAdmin } from "@/lib/guards";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Ret gerekçesi en az 3 karakter olmalıdır.")
    .max(1000, "Ret gerekçesi çok uzun."),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = rejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Geçerli bir ret gerekçesi girilmelidir.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Gönderi bulunamadı." },
        { status: 404 },
      );
    }

    if (post.status !== PostStatus.PENDING) {
      return NextResponse.json(
        { error: "Yalnızca bekleyen gönderiler reddedilebilir." },
        { status: 409 },
      );
    }

    const rejectedPost = await prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.REJECTED,
        rejectReason: parsed.data.reason,
      },
    });

    return NextResponse.json({
      message: "Gönderi reddedildi.",
      post: rejectedPost,
    });
  } catch {
    return NextResponse.json(
      { error: "Yönetici yetkisi gerekli veya reddetme başarısız." },
      { status: 403 },
    );
  }
}
