import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { rejectUser } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/reject — onay bekleyen başvuruyu reddeder (kayıt silinir)
export async function POST(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await rejectUser(admin.id, id);
    return NextResponse.json({ message: "Başvuru reddedildi" });
  } catch (error) {
    return handleApiError(error);
  }
}
