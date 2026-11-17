import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { unbanUser } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/unban — ban veya kısıtlamayı kaldırır
export async function POST(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await unbanUser(admin.id, id);
    return NextResponse.json({ user, message: "Ceza kaldırıldı" });
  } catch (error) {
    return handleApiError(error);
  }
}
