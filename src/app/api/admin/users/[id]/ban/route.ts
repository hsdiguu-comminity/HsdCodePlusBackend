import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { banSchema } from "@/lib/validations/admin";
import { banUser } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/ban — { reason, days? } — days verilmezse kalıcı ban (giriş yapamaz)
export async function POST(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = banSchema.parse(await readJson(req));
    const result = await banUser(admin, id, input);
    return NextResponse.json({ ...result, message: "Kullanıcı banlandı" });
  } catch (error) {
    return handleApiError(error);
  }
}
