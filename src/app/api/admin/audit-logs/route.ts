import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { paginationSchema } from "@/lib/validations/admin";
import { listAuditLogs } from "@/services/admin.service";

// GET /api/admin/audit-logs?page=1&pageSize=20 — en yeni işlem en üstte
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { page, pageSize } = paginationSchema.parse(params);
    const result = await listAuditLogs(page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
