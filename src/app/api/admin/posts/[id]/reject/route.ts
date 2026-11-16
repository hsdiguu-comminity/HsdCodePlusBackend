import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { rejectPostSchema } from "@/lib/validations/post";
import { rejectPost } from "@/services/post.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/posts/[id]/reject — { reason } — gerekçe yazara gösterilir
export async function POST(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { reason } = rejectPostSchema.parse(await readJson(req));
    const post = await rejectPost(admin.id, id, reason);
    return NextResponse.json({ post, message: "Yazı reddedildi" });
  } catch (error) {
    return handleApiError(error);
  }
}
