# HSDCode+ — Backend Proje Dokümanı

> **Backend Ekibi:** Alp (Lead / DevOps / Mentör), İrem, Eren, Furkan (Backend / Data)
> **Süre:** 6 hafta (1.5 ay) — Frontend ile paralel ilerler
> **Geliştirme ortamı:** Visual Studio Code + Docker Desktop

---

## 1. Teknoloji Yığını

| Katman | Teknoloji | Not |
|---|---|---|
| Çalışma ortamı | **Node.js 22 LTS** | |
| API | **Next.js Route Handlers** (`src/app/api/*`) | Frontend ile aynı repo |
| Dil | TypeScript | |
| Veritabanı | **PostgreSQL 16** | Docker container içinde |
| ORM | **Prisma** | Şema + migration yönetimi |
| Doğrulama | **Zod** | Frontend ile ortak şemalar |
| Kimlik doğrulama | **Auth.js (NextAuth v5)** – Credentials | HttpOnly cookie oturum |
| Şifreleme | **argon2** (veya bcrypt) | Şifreler asla düz metin tutulmaz |
| E-posta | Nodemailer (SMTP) veya Resend | Şifre sıfırlama, üyelik onay bildirimi |
| Dosya yükleme | Yerel `uploads/` (geliştirme) → Huawei Cloud OBS / S3 uyumlu depolama (canlı) | Blog görselleri |
| Veri / Script | **Python 3.12** + `psycopg` + `pandas` | Seed, yedekleme, raporlama (Furkan) |
| Konteyner | **Docker Desktop** + `docker-compose` | |
| Test | Vitest (birim), Playwright (admin paneli E2E) | |

---

## 2. Yerel Geliştirme Ortamı (Docker)

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    container_name: hsdcode-db
    environment:
      POSTGRES_USER: hsd
      POSTGRES_PASSWORD: hsd_dev_password
      POSTGRES_DB: hsdcode
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  adminer:
    image: adminer
    ports:
      - "8080:8080"   # Tarayıcıdan veritabanını görmek için

  mailpit:
    image: axllent/mailpit
    ports:
      - "8025:8025"   # Şifre sıfırlama e-postalarını yerelde görmek için
      - "1025:1025"

volumes:
  pgdata:
```

Başlatma adımları:

```bash
docker compose up -d          # Veritabanını başlat
npm install
npx prisma migrate dev        # Tabloları oluştur
python scripts/seed.py        # Örnek veri (Furkan)
npm run dev                   # http://localhost:3000
```

`.env.example` (gerçek `.env` **asla** GitHub'a gönderilmez):

```
DATABASE_URL="postgresql://hsd:hsd_dev_password@localhost:5432/hsdcode"
AUTH_SECRET="openssl rand -base64 32 ile üretin"
SMTP_HOST="localhost"
SMTP_PORT="1025"
APP_URL="http://localhost:3000"
```

---

## 3. Veritabanı Şeması

### 3.1 Tablolar

| Tablo | Amaç | Önemli alanlar |
|---|---|---|
| `hsd_communities` | Üniversite HSD toplulukları | `id`, `name`, `university`, `city` |
| `users` | Üyeler | `id`, `email`, `password_hash`, `first_name`, `last_name`, `username`, `community_id`, `role` (`MEMBER`/`ADMIN`), `status` (`PENDING`/`ACTIVE`/`RESTRICTED`/`BANNED`), `created_at` |
| `profiles` | Profil detayları | `user_id`, `bio`, `avatar_url`, `github_url`, `linkedin_url` |
| `categories` | Ortak kategoriler | `id`, `name`, `slug` — Yapay Zeka, Siber Güvenlik, Web, Veri Bilimi |
| `posts` | Blog yazıları | `id`, `author_id`, `category_id`, `title`, `slug`, `content_md`, `cover_url`, `status` (`DRAFT`/`PENDING`/`APPROVED`/`REJECTED`), `reject_reason`, `published_at` |
| `post_images` | Yazıya ait görseller | `id`, `post_id`, `url` |
| `quizzes` | Quizler (yalnızca admin oluşturur) | `id`, `category_id`, `title`, `description`, `time_limit_sec`, `starts_at`, `ends_at`, `is_published`, `created_by` |
| `questions` | Quiz soruları | `id`, `quiz_id`, `text`, `points`, `order` |
| `options` | Şıklar | `id`, `question_id`, `text`, `is_correct` |
| `quiz_attempts` | Kullanıcının quiz denemesi | `id`, `user_id`, `quiz_id`, `score`, `started_at`, `finished_at` — (`user_id`, `quiz_id`) **unique** |
| `attempt_answers` | Verilen cevaplar | `attempt_id`, `question_id`, `option_id` |
| `score_events` | Puan hareketleri (leaderboard kaynağı) | `id`, `user_id`, `points`, `source` (`QUIZ`/`POST_APPROVED`/`BONUS`), `ref_id`, `created_at` |
| `bans` | Kısıtlama / ban kayıtları | `id`, `user_id`, `type` (`RESTRICT`/`BAN`), `reason`, `admin_id`, `expires_at` |
| `password_reset_tokens` | Şifre sıfırlama | `id`, `user_id`, `token_hash`, `expires_at`, `used_at` |
| `audit_logs` | Admin işlem kayıtları | `id`, `admin_id`, `action`, `target_type`, `target_id`, `created_at` |

### 3.2 Leaderboard Mantığı

Puanlar doğrudan `users` tablosuna yazılmaz; her kazanım `score_events` tablosuna bir satır olarak eklenir. Böylece günlük/haftalık/aylık sıralama tek sorgu ile hesaplanır:

```sql
SELECT u.first_name, u.last_name, c.name AS hsd, SUM(s.points) AS puan
FROM score_events s
JOIN users u ON u.id = s.user_id
JOIN hsd_communities c ON c.id = u.community_id
WHERE s.created_at >= date_trunc('week', now())   -- 'day' / 'week' / 'month'
  AND u.status = 'ACTIVE'
GROUP BY u.id, c.name
ORDER BY puan DESC
LIMIT 50;
```

`score_events (created_at)` ve `(user_id, created_at)` üzerine index eklenir. Kullanıcı sayısı artarsa sonuçlar 5 dakikalık önbellekle sunulur.

---

## 4. API Sözleşmesi (Endpoint Listesi)

Tüm yanıtlar JSON'dur. Hata formatı: `{ "error": { "code": "STRING", "message": "Türkçe açıklama" } }`

### 4.1 Kimlik Doğrulama

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Kayıt — kullanıcı `PENDING` durumunda oluşur |
| POST | `/api/auth/login` | Giriş — `PENDING`/`BANNED` ise reddedilir |
| POST | `/api/auth/logout` | Çıkış |
| POST | `/api/auth/forgot-password` | Sıfırlama e-postası gönderir (kullanıcı yoksa bile aynı yanıt) |
| POST | `/api/auth/reset-password` | Token + yeni şifre |
| GET | `/api/auth/me` | Oturumdaki kullanıcı |

### 4.2 Blog

| Metot | Endpoint | Yetki |
|---|---|---|
| GET | `/api/posts?category=&q=&page=` | Herkes (yalnızca `APPROVED`) |
| GET | `/api/posts/[slug]` | Herkes |
| POST | `/api/posts` | Aktif üye — `PENDING` olarak kaydedilir |
| PATCH | `/api/posts/[id]` | Yazar (onaydan önce) |
| DELETE | `/api/posts/[id]` | Yazar / Admin |
| POST | `/api/uploads` | Aktif üye — yalnızca `jpg/png/webp`, en fazla 2 MB |

### 4.3 Quiz

| Metot | Endpoint | Yetki |
|---|---|---|
| GET | `/api/quizzes?category=` | Herkes |
| GET | `/api/quizzes/[id]` | Herkes (doğru cevaplar **gönderilmez**) |
| POST | `/api/quizzes/[id]/start` | Aktif üye — deneme başlatır |
| POST | `/api/quizzes/[id]/submit` | Aktif üye — puan **sunucuda** hesaplanır |

### 4.4 Leaderboard & Profil

| Metot | Endpoint | Yetki |
|---|---|---|
| GET | `/api/leaderboard?period=daily\|weekly\|monthly&community=` | Herkes |
| GET | `/api/users/[username]` | Herkes (herkese açık alanlar) |
| PATCH | `/api/users/me` | Kendisi |
| GET | `/api/users/me/dashboard` | Kendisi — puan, yazılar, quiz geçmişi |
| GET | `/api/communities` | Herkes — kayıt formundaki HSD listesi |

### 4.5 Admin Paneli (yalnızca `ADMIN`)

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/admin/users?status=PENDING` | Onay bekleyen üyeler |
| POST | `/api/admin/users/[id]/approve` | Üyeliği onayla (+ bilgilendirme e-postası) |
| POST | `/api/admin/users/[id]/reject` | Üyeliği reddet |
| POST | `/api/admin/users/[id]/restrict` | Kısıtla (paylaşım yapamaz, süreli) |
| POST | `/api/admin/users/[id]/ban` | Banla (giriş yapamaz) + gerekçe |
| POST | `/api/admin/users/[id]/unban` | Ban kaldır |
| GET | `/api/admin/posts?status=PENDING` | Onay bekleyen yazılar |
| POST | `/api/admin/posts/[id]/approve` | Yazıyı yayınla (+ yazara puan) |
| POST | `/api/admin/posts/[id]/reject` | Gerekçe ile reddet |
| CRUD | `/api/admin/quizzes` | Quiz oluştur/düzenle/sil/yayınla |
| CRUD | `/api/admin/quizzes/[id]/questions` | Soru & şık yönetimi |
| CRUD | `/api/admin/categories` | Kategori yönetimi |
| GET | `/api/admin/audit-logs` | Admin işlem geçmişi |

Her admin işlemi `audit_logs` tablosuna yazılır.

---

## 5. Güvenlik

| Konu | Uygulama |
|---|---|
| **Güvenlik duvarı (WAF)** | Canlıda Cloudflare (ücretsiz plan) veya Huawei Cloud WAF — DDoS, bot ve kötü amaçlı istek filtreleme |
| **Rate limiting** | Giriş: 5 deneme / 15 dk / IP; kayıt ve şifre sıfırlama: 3 / saat; genel API: 100 / dk |
| **Şifreler** | argon2 ile hash; en az 8 karakter, harf + rakam |
| **Şifremi unuttum** | 32 bayt rastgele token, veritabanında **hash'i** tutulur, 30 dk geçerli, tek kullanımlık |
| **SQL Injection** | Prisma parametreli sorgular; ham SQL'de yalnızca `$queryRaw` şablonu |
| **XSS** | Markdown içerik `sanitize` edilerek render edilir (`rehype-sanitize`); `dangerouslySetInnerHTML` yasak |
| **CSRF** | Auth.js CSRF koruması + `SameSite=Lax` cookie |
| **Yetkilendirme** | Her endpoint'te rol ve `status` kontrolü (ortak `requireUser()` / `requireAdmin()` yardımcıları) |
| **Quiz hilesi** | Doğru cevaplar istemciye gönderilmez; puan sunucuda hesaplanır; bir quiz bir kez çözülür; süre sunucuda kontrol edilir |
| **Dosya yükleme** | MIME + uzantı kontrolü, boyut sınırı, rastgele dosya adı |
| **Güvenlik başlıkları** | CSP, `X-Frame-Options`, `Strict-Transport-Security` (`next.config.ts` içinde) |
| **Gizli bilgiler** | `.env` GitHub'a gönderilmez; canlıda ortam değişkeni olarak tanımlanır |
| **Bağımlılıklar** | `npm audit` ve GitHub Dependabot açık |

---

## 6. Python ile Veritabanı Yönetimi (Furkan)

`scripts/` klasörü:

| Script | Görev |
|---|---|
| `seed.py` | HSD toplulukları, kategoriler, örnek kullanıcı/yazı/quiz verisi |
| `backup.py` | `pg_dump` ile günlük yedek, son 7 yedeği tutar |
| `import_questions.py` | Excel/CSV'den toplu quiz sorusu aktarımı (admin kolaylığı) |
| `reports.py` | Haftalık rapor: yeni üye, yayınlanan yazı, quiz katılımı, en aktif HSD'ler |
| `cleanup.py` | Süresi dolmuş sıfırlama token'larını ve eski oturumları temizler |

> **Kural:** Tablo yapısı yalnızca **Prisma migration** ile değiştirilir. Python scriptleri veri okur/yazar ama `ALTER TABLE` çalıştırmaz — böylece iki araç birbiriyle çakışmaz.

---

## 7. Admin Paneli Testleri (Vibecoding)

Admin panelinin çalışıp çalışmadığı, yapay zeka destekli (vibecoding) yazılan **Playwright** testleriyle kontrol edilir. Her test senaryosu önce düz Türkçe yazılır, sonra AI asistanı ile koda dönüştürülür ve **mutlaka bir ekip üyesi tarafından okunup çalıştırılır.**

Minimum test senaryoları:

- [ ] Kayıt olan kullanıcı `PENDING` görünür → admin onaylar → kullanıcı giriş yapabilir
- [ ] Onaylanmamış kullanıcı giriş yapamaz
- [ ] Gönderilen yazı listede görünmez → admin onaylar → blogda görünür, yazara puan eklenir
- [ ] Reddedilen yazıda gerekçe yazara gösterilir
- [ ] Banlanan kullanıcı giriş yapamaz; kısıtlanan kullanıcı yazı gönderemez
- [ ] Normal üye `/admin` sayfalarına ve `/api/admin/*` endpoint'lerine erişemez (403)
- [ ] Admin quiz oluşturur → yayınlar → üye çözer → leaderboard güncellenir
- [ ] Aynı quiz ikinci kez çözülemez
- [ ] Şifremi unuttum akışı uçtan uca çalışır (Mailpit üzerinden)

---

## 8. Deploy (Alp)

| Seçenek | Uygulama | Veritabanı |
|---|---|---|
| **A — Önerilen (hızlı başlangıç)** | Vercel | Neon veya Supabase (yönetilen PostgreSQL) |
| **B — Huawei ekosistemi** | Huawei Cloud ECS üzerinde Docker | Huawei Cloud RDS for PostgreSQL |

Ortamlar:

- `develop` dalı → **staging** (test ortamı)
- `main` dalı → **production** (canlı site)

GitHub Actions ile her PR'da: `lint` → `typecheck` → `test` → `build`. Başarısız PR birleştirilemez.

---

## 9. Haftalık Backend Planı

| Hafta | Hedef |
|---|---|
| **1** | Docker ortamı, Prisma şeması, ilk migration, `.env.example`, GitHub reposu ve dal kuralları |
| **2** | Kayıt / giriş / oturum, rol ve durum kontrolü, `seed.py` |
| **3** | Blog CRUD, görsel yükleme, admin üye onay + yazı onay endpoint'leri |
| **4** | Quiz modeli, quiz çözme ve puanlama, `score_events`, ban/kısıtlama |
| **5** | Leaderboard, dashboard/profil endpoint'leri, şifremi unuttum, rate limit, güvenlik başlıkları |
| **6** | Playwright admin testleri, staging deploy, WAF, yedekleme, hata düzeltme, **canlıya çıkış** |
