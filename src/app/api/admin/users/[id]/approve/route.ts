import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { approveUser } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/approve — üyeliği onaylar ve bilgilendirme e-postası gönderir
export async function POST(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await approveUser(admin.id, id);
    return NextResponse.json({ user, message: "Üyelik onaylandı" });
  } catch (error) {
    return handleApiError(error);
  }
}
