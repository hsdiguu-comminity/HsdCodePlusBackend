import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { createPostSchema, postListQuerySchema } from "@/lib/validations/post";
import { createPost, listPublishedPosts } from "@/services/post.service";

// GET /api/posts?category=web&q=next&page=1 — yayındaki yazılar (herkese açık)
export async function GET(req: Request) {
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const query = postListQuerySchema.parse(params);
    return NextResponse.json(await listPublishedPosts(query));
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/posts — { title, categoryId, contentMd, coverUrl? } — yazı onaya gönderilir.
// Kısıtlanmış (RESTRICTED) üyeler yazı gönderemez.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = createPostSchema.parse(await readJson(req));
    const post = await createPost(user.id, input);
    return NextResponse.json(
      { post, message: "Yazınız onaya gönderildi" },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
