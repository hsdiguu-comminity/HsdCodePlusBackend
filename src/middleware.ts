import { NextResponse } from "next/server";

// Şimdilik her isteği olduğu gibi geçirir.
// TODO (Alp): CORS (FRONTEND_URL), güvenlik başlıkları ve rate limiting buraya eklenecek.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
