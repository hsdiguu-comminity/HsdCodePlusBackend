import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  try {
    await signOut({
      redirect: false,
    });

    return NextResponse.json({
      success: true,
      message: "Oturum başarıyla kapatıldı.",
    });
  } catch (error) {
    console.error("Logout API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Oturum kapatılamadı.",
      },
      { status: 500 }
    );
  }
}