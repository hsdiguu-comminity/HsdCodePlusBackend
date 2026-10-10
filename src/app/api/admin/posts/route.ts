
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@/generated/prisma";
import { requireAdmin } from "@/lib/guards";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = request.nextUrl.searchParams;
    const statusParam = params.get("status") || "PENDING";

    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ] as const;

    if (
      !allowedStatuses.includes(
        statusParam as (typeof allowedStatuses)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Geçersiz gönderi durumu." },
        { status: 400 },
      );
    }

    const status = statusParam as (typeof allowedStatuses)[number];

    const posts = await prisma.post.findMany({
      where: { status: PostStatus[status] },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
      },
    });

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json(
      { error: "Yönetici yetkisi gerekli veya gönderiler alınamadı." },
      { status: 403 },
    );
  }
}
