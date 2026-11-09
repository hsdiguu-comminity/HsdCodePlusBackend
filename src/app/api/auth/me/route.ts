import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: session.user,
    });
  } catch (error) {
    console.error("Auth me API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Kullanıcı bilgileri alınamadı.",
      },
      { status: 500 }
    );
  }
}