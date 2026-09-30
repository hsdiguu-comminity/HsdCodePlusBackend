# HSDCode+ Backend

HSDCode+ API'si (Next.js Route Handlers + Prisma + PostgreSQL 16 + Auth.js).

> Detaylı plan ve API sözleşmesi: [docs/02_BACKEND.md](docs/02_BACKEND.md) · Görev dağılımı: [docs/03_GOREV_DAGILIMI.md](docs/03_GOREV_DAGILIMI.md)

## Klasör Yapısı ve Sorumlular

| Klasör / Dosya | İçerik | Sorumlu |
|---|---|---|
| `src/app/api/auth/*` | Kayıt, giriş, çıkış, şifremi unuttum, `me` | Alp |
| `src/lib/auth.ts`, `guards.ts`, `password.ts`, `rate-limit.ts`, `mail.ts`, `src/middleware.ts` | Auth.js, `requireUser()`/`requireAdmin()`, güvenlik | Alp |
| `src/app/api/posts/*`, `uploads` | Blog CRUD, görsel yükleme | İrem |
| `src/app/api/admin/posts/*`, `src/lib/sanitize.ts`, `upload.ts` | Yazı onay/red, markdown güvenliği | İrem |
| `src/app/api/quizzes/*`, `admin/quizzes/*`, `admin/categories/*`, `src/lib/scoring.ts` | Quiz sistemi ve puanlama | Eren |
| `src/app/api/admin/users/*`, `admin/audit-logs`, `src/lib/audit.ts` | Üye onay, ban/kısıtlama, audit log | Eren |
| `prisma/schema.prisma`, `prisma/migrations` | Veritabanı şeması | Furkan |
| `src/app/api/leaderboard`, `users/*`, `communities` | Leaderboard, profil, dashboard | Furkan |
| `scripts/*.py` | seed, backup, import_questions, reports, cleanup | Furkan |
| `tests/e2e` | Playwright admin testleri | Ekip |
| `.github/workflows/ci.yml` | lint → typecheck → test → build | Alp |

## Kurulum

```bash
docker compose up -d
cp .env.example .env
npm install
npx prisma migrate dev
python scripts/seed.py
npm run dev
```

- Adminer: http://localhost:8080 · Mailpit: http://localhost:8025

> Kural: Tablo yapısı yalnızca Prisma migration ile değiştirilir; Python scriptleri `ALTER TABLE` çalıştırmaz.
