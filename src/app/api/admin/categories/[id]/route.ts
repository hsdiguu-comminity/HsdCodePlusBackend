import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { updateCategorySchema } from "@/lib/validations/admin";
import { deleteCategory, updateCategory } from "@/services/admin.service";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/admin/categories/[id] — { name?, slug? }
export async function PATCH(req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = updateCategorySchema.parse(await readJson(req));
    const category = await updateCategory(admin.id, id, input);
    return NextResponse.json({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/admin/categories/[id] — içinde yazı veya quiz olan kategori silinemez
export async function DELETE(_req: Request, { params }: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await deleteCategory(admin.id, id);
    return NextResponse.json({ message: "Kategori silindi" });
  } catch (error) {
    return handleApiError(error);
  }
}
