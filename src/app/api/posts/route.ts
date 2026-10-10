
import { NextRequest, NextResponse } from "next/server";
import { createPostSchema } from "@/lib/validations/post";
import {
  createPost,
  listPublishedPosts,
} from "@/services/post.service";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { requireUser } from "@/lib/guards";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, Number(params.get("page") || 1));
    const category = params.get("category") || undefined;
    const q = params.get("q")?.trim() || undefined;

    if (!Number.isInteger(page)) {
      return NextResponse.json(
        { error: "Geçersiz sayfa numarası." },
        { status: 400 },
      );
    }

    const result = await listPublishedPosts({
      page,
      category,
      q,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Gönderiler alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Gönderi bilgileri geçersiz.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const slug = `${slugify(data.title)}-${crypto.randomUUID().slice(0, 8)}`;
    const safeContent = await sanitizeMarkdown(data.contentMd);

    const post = await createPost({
      authorId: user.id,
      title: data.title,
      categoryId: data.categoryId,
      contentMd: safeContent,
      coverUrl: data.coverUrl || undefined,
      slug,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gönderi oluşturulamadı.";

    if (message.toLowerCase().includes("unauthorized")) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Gönderi oluşturulamadı." },
      { status: 500 },
    );
  }
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
