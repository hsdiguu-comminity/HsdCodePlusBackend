import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { adminPostListQuerySchema } from "@/lib/validations/post";
import { listPostsForAdmin } from "@/services/post.service";

// GET /api/admin/posts?status=PENDING&page=1 — onay bekleyen (veya diğer durumdaki) yazılar
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { status, page, pageSize } = adminPostListQuerySchema.parse(params);
    return NextResponse.json(await listPostsForAdmin(status, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}
