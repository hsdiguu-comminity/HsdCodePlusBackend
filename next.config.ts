import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Tüm yanıtlara eklenen güvenlik başlıkları
const securityHeaders = [
  // Backend yalnızca JSON döndürür; sayfa, script veya iframe yüklemesine gerek yok
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS zorunluluğu yalnızca canlıda (yerelde http kullanılıyor)
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;