import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

// POST /api/auth/logout — oturum çerezini siler
export async function POST() {
  try {
    await signOut({ redirect: false });
    return NextResponse.json({ message: "Çıkış yapıldı" });
  } catch (error) {
    return handleApiError(error);
  }
}