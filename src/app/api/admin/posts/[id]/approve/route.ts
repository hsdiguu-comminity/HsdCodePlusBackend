import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { POST_APPROVED_POINTS, approvePost } from "@/services/post.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/posts/[id]/approve — yazıyı yayınlar ve yazara puan verir
export async function POST(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const post = await approvePost(admin.id, id);
    return NextResponse.json({
      post,
      pointsAwarded: POST_APPROVED_POINTS,
      message: "Yazı onaylandı ve yayınlandı",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
