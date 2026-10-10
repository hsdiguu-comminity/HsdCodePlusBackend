import { Errors } from "@/lib/errors";

// Basit, bellekte tutulan sabit pencereli sayaç.
// Tek sunucuda (yerel geliştirme, tek container) yeterlidir. Birden fazla sunucuya
// (ör. Vercel) geçildiğinde Redis/Upstash gibi ortak bir depoya taşınmalıdır.
type Bucket = { count: number; resetAt: number };

// Sayaçlar globalThis'te tutulur; böylece tüm route'lar aynı sayacı paylaşır
const globalForRateLimit = globalThis as unknown as { rateLimitBuckets?: Map<string, Bucket> };
const buckets = (globalForRateLimit.rateLimitBuckets ??= new Map<string, Bucket>());

export const RateLimits = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  register: { limit: 3, windowMs: 60 * 60 * 1000 },
  forgotPassword: { limit: 3, windowMs: 60 * 60 * 1000 },
  resetPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
  api: { limit: 100, windowMs: 60 * 1000 },
} as const;

type RateLimitRule = { limit: number; windowMs: number };

// Sınır aşılmadıysa true döner ve sayacı artırır
export function checkRateLimit(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    cleanup(now);
    return true;
  }

  if (bucket.count >= rule.limit) return false;
  bucket.count++;
  return true;
}

// Route'larda kullanılır: sınır aşılırsa 429 hatası fırlatır
export function rateLimit(key: string, rule: RateLimitRule) {
  if (!checkRateLimit(key, rule)) throw Errors.tooManyRequests();
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Süresi dolmuş sayaçları ara ara temizler (bellek şişmesin)
let lastCleanup = 0;
function cleanup(now: number) {
  if (now - lastCleanup < 60 * 1000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}