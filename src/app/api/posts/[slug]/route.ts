import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { updatePostSchema } from "@/lib/validations/post";
import { deletePost, getPublishedPost, updatePost } from "@/services/post.service";

// Not: Next.js aynı klasörde hem [slug] hem [id] kullanmaya izin vermez.
// GET slug ile çalışır; PATCH ve DELETE yazının id'sini veya slug'ını kabul eder.
type Context = { params: Promise<{ slug: string }> };

// GET /api/posts/[slug] — yayındaki yazı (contentHtml: güvenli HTML)
export async function GET(_req: Request, { params }: Context) {
  try {
    const { slug } = await params;
    return NextResponse.json({ post: await getPublishedPost(slug) });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/posts/[id veya slug] — yazar, onaylanmamış yazısını düzenler (yeniden onaya düşer)
export async function PATCH(req: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { slug } = await params;
    const input = updatePostSchema.parse(await readJson(req));
    const post = await updatePost(user, slug, input);
    return NextResponse.json({ post, message: "Yazınız güncellendi ve yeniden onaya gönderildi" });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/posts/[id veya slug] — yazar kendi yazısını, admin her yazıyı silebilir
export async function DELETE(_req: Request, { params }: Context) {
  try {
    const user = await requireUser({ allowRestricted: true });
    const { slug } = await params;
    await deletePost(user, slug);
    return NextResponse.json({ message: "Yazı silindi" });
  } catch (error) {
    return handleApiError(error);
  }
}
