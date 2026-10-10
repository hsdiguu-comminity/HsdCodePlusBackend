
import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedPostBySlug,
  updatePost,
  deletePost,
} from "@/services/post.service";
import { updatePostSchema } from "@/lib/validations/post";
import { requireUser } from "@/lib/guards";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug } = await params;
    const post = await getPublishedPostBySlug(slug);

    if (!post) {
      return NextResponse.json(
        { error: "Gönderi bulunamadı." },
        { status: 404 },
      );
    }

    return NextResponse.json({ post });
  } catch {
    return NextResponse.json(
      { error: "Gönderi alınamadı." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await requireUser();
    const { slug } = await params;
    const body: unknown = await request.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Gönderi bilgileri geçersiz." },
        { status: 400 },
      );
    }

    const post = await updatePost(slug, user.id, parsed.data);

    return NextResponse.json({ post });
  } catch {
    return NextResponse.json(
      { error: "Gönderi güncellenemedi veya yetkiniz yok." },
      { status: 403 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await requireUser();
    const { slug } = await params;

    await deletePost(slug, user.id);

    return NextResponse.json(
      { message: "Gönderi silindi." },
    );
  } catch {
    return NextResponse.json(
      { error: "Gönderi silinemedi veya yetkiniz yok." },
      { status: 403 },
    );
  }
}
