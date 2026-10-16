import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { categorySchema } from "@/lib/validations/admin";
import { createCategory, listCategories } from "@/services/admin.service";

// GET /api/admin/categories — yazı ve quiz sayılarıyla
export async function GET() {
  try {
    await requireAdmin();
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/admin/categories — { name, slug? } (slug verilmezse addan üretilir)
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const input = categorySchema.parse(await readJson(req));
    const category = await createCategory(admin.id, input);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
