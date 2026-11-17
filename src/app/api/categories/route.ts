import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

// GET /api/categories — blog/quiz filtreleri ve yazı formu için kategori listesi (herkese açık)
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}
