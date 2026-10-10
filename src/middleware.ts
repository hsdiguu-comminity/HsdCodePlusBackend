import { NextResponse, type NextRequest } from "next/server";
import { RateLimits, checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Frontend ayrı bir uygulama olduğu için (localhost:3001) çerezli isteklere izin verilen adresler.
// Birden fazla adres virgülle yazılabilir: FRONTEND_URL="http://localhost:3001,https://hsdcode.com"
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function corsHeaders(origin: string | null) {
  const headers = new Headers();
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function jsonError(status: number, code: string, message: string, headers: Headers) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Tarayıcının ön kontrol (preflight) isteği
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  // CSRF koruması: veri değiştiren istekler yalnızca izinli sitelerden gelebilir
  if (
    !SAFE_METHODS.has(req.method) &&
    origin &&
    origin !== req.nextUrl.origin &&
    !allowedOrigins.includes(origin)
  ) {
    return jsonError(403, "FORBIDDEN_ORIGIN", "Bu kaynaktan gelen isteklere izin verilmiyor", headers);
  }

  // Genel API sınırı: IP başına dakikada 100 istek
  if (!checkRateLimit(`api:${getClientIp(req)}`, RateLimits.api)) {
    return jsonError(
      429,
      "TOO_MANY_REQUESTS",
      "Çok fazla istek gönderdiniz, lütfen biraz bekleyin",
      headers
    );
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};