import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/guards";
import { userListQuerySchema } from "@/lib/validations/admin";
import { listUsers } from "@/services/admin.service";

// GET /api/admin/users?status=PENDING&q=ali&page=1&pageSize=20
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const query = userListQuerySchema.parse(params);
    const result = await listUsers(query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
