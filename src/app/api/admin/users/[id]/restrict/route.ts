import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { restrictSchema } from "@/lib/validations/admin";
import { restrictUser } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/restrict — { reason, days } — süreli kısıtlama (paylaşım yapamaz)
export async function POST(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = restrictSchema.parse(await readJson(req));
    const result = await restrictUser(admin, id, input);
    return NextResponse.json({ ...result, message: "Kullanıcı kısıtlandı" });
  } catch (error) {
    return handleApiError(error);
  }
}
