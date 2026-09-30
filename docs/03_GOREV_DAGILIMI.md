# HSDCode+ — Görev Dağılımı ve Proje Planı

> **Proje:** HSDCode+ — İstanbul Gelişim Üniversitesi Huawei Student Developer topluluğu
> **Ekip:** 6 yazılımcı öğrenci (2 Frontend, 4 Backend)
> **Süre:** 6 hafta (1.5 ay) — Frontend ve Backend paralel
> **Araçlar:** Visual Studio Code, Docker Desktop, GitHub (tanıtımdan sonra kurulacak)

---

## 1. Ekip ve Roller

| Üye | Alan | Rol | Ana Sorumluluklar |
|---|---|---|---|
| **Alp** | Backend + DevOps | **Proje Yöneticisi / Tech Lead / Mentör** | Mimari kararlar, GitHub & deploy, kimlik doğrulama, güvenlik, kod incelemesi, ekibe destek |
| **İrem** | Backend | Geliştirici | Blog sistemi, görsel yükleme, **yazı onay paneli** API'leri |
| **Eren** | Backend | Geliştirici | Quiz sistemi, puanlama, **üye onay & ban** API'leri |
| **Furkan** | Backend / Data | Veri Sorumlusu | PostgreSQL şeması, Python scriptleri (seed, yedek, rapor), **leaderboard** sorguları |
| **Ümmügülsüm** | Frontend | **Frontend Lead** (Alp'ten sonra frontend yöneticisi) | Mimari, tasarım sistemi, karmaşık sayfalar, Aleyna'ya mentörlük, frontend PR incelemesi |
| **Aleyna** | Frontend | Geliştirici (öğrenme sürecinde) | Temel bileşenler, statik sayfalar, Ümmügülsüm eşliğinde ilerleme |

### Yetki Hiyerarşisi

```
                 Alp (Proje Yöneticisi)
                /                      \
     Backend Ekibi                  Ümmügülsüm (Frontend Lead)
  İrem · Eren · Furkan                     |
                                        Aleyna
```

---

## 2. Detaylı Görev Dağılımı

### 🔧 Alp — Proje Yöneticisi / Backend Lead

- [ ] GitHub organizasyonu ve reposunun kurulması, dal koruma kuralları
- [ ] Next.js + Prisma + Docker proje iskeletinin hazırlanması
- [ ] Auth.js ile kayıt / giriş / oturum yönetimi
- [ ] `requireUser()` / `requireAdmin()` yetki yardımcıları
- [ ] Şifremi unuttum akışı (e-posta + token)
- [ ] Güvenlik: rate limiting, güvenlik başlıkları, WAF kurulumu
- [ ] GitHub Actions (lint, test, build) ve staging/production deploy
- [ ] Tüm backend PR'larının incelenmesi
- [ ] Haftalık toplantıların yönetimi, engel kaldırma, mentörlük

### 🔧 İrem — Backend (Blog)

- [ ] Blog CRUD endpoint'leri (`/api/posts`)
- [ ] Görsel yükleme (`/api/uploads`) — tür/boyut kontrolü
- [ ] Markdown içerik güvenliği (sanitize)
- [ ] Admin yazı onay/red endpoint'leri + red gerekçesi
- [ ] Yazı onaylandığında `score_events`'e puan ekleme
- [ ] Blog arama, kategori filtresi, sayfalama

### 🔧 Eren — Backend (Quiz & Moderasyon)

- [ ] Quiz, soru, şık modelleri ve admin CRUD endpoint'leri
- [ ] Quiz kategorileri (Yapay Zeka, Siber Güvenlik, Web, Veri Bilimi)
- [ ] Quiz başlatma / gönderme, sunucu tarafı puanlama ve süre kontrolü
- [ ] Hile önlemleri (cevapların istemciye gitmemesi, tek deneme)
- [ ] Admin üye onay/red endpoint'leri
- [ ] Kısıtlama / ban sistemi ve `audit_logs`

### 📊 Furkan — Backend / Data

- [ ] Veritabanı şemasının tasarımı (Prisma) ve index'ler
- [ ] `docker-compose.yml` içinde PostgreSQL + Adminer
- [ ] Python: `seed.py`, `backup.py`, `import_questions.py`, `reports.py`, `cleanup.py`
- [ ] Leaderboard sorguları (günlük / haftalık / aylık, HSD bazlı filtre)
- [ ] Dashboard ve profil istatistik endpoint'leri
- [ ] Türkiye'deki HSD topluluk listesinin veritabanına eklenmesi

### 🎨 Ümmügülsüm — Frontend Lead

- [ ] Wireframe'ler ve tasarım sistemi (renk, font, boşluk)
- [ ] `index.html`'in Next.js Ana Sayfa'ya dönüştürülmesi
- [ ] Layout, Navbar, Footer, Modal, Tabs, Pagination
- [ ] Giriş / Kayıt / Şifremi Unuttum sayfaları
- [ ] Quiz çözme ekranı (zamanlayıcı, ilerleme, sonuç)
- [ ] Dashboard, Profil ve **Admin Paneli** arayüzleri
- [ ] API entegrasyonu, Aleyna'nın PR'larını inceleme ve eşlikli çalışma

### 🎨 Aleyna — Frontend

- [ ] Hafta 1: Git, VS Code, HTML/CSS/TS ve Next.js temelleri (Ümmügülsüm eşliğinde)
- [ ] `Button`, `Input`, `Card`, `Badge`, `Spinner`, `Toast` bileşenleri
- [ ] Hakkımızda sayfası
- [ ] Blog liste ve blog detay sayfaları
- [ ] Leaderboard sayfası (Günlük / Haftalık / Aylık sekmeleri)
- [ ] Yazı oluşturma sayfası
- [ ] Mobil uyumluluk testleri

> **Aleyna için öneri:** Her hafta en az bir kez Ümmügülsüm ile **pair programming** (birlikte kodlama) oturumu yapılması ve ilk görevlerin küçük, bağımsız bileşenler olarak seçilmesi.

---

## 3. 6 Haftalık Yol Haritası

| Hafta | Kilometre Taşı | Frontend | Backend |
|---|---|---|---|
| **0** (tanıtım sonrası) | Başlangıç | GitHub hesapları, VS Code kurulumu | GitHub repo, Docker Desktop kurulumu |
| **1** | Altyapı hazır | Proje iskeleti, tasarım sistemi, wireframe | Docker + PostgreSQL, Prisma şeması, ilk migration |
| **2** | İskelet + Auth | Layout, Ana Sayfa, Hakkımızda | Kayıt/Giriş, roller, seed verisi |
| **3** | Blog | Auth sayfaları, Blog liste (mock) | Blog API, görsel yükleme, üye & yazı onay API |
| **4** | Quiz | Quiz sayfaları, Blog detay | Quiz API, puanlama, ban/kısıtlama |
| **5** | Profil + Admin | Dashboard, Profil, Leaderboard, Admin UI | Leaderboard, dashboard API, şifremi unuttum, güvenlik |
| **6** | **Yayın** 🚀 | API entegrasyonu, responsive test | Admin E2E testleri, staging → production deploy, WAF, yedek |

### Kritik Bağımlılıklar

| Frontend bekliyor | Backend teslim etmeli | Son tarih |
|---|---|---|
| Kayıt/Giriş sayfaları | `/api/auth/*` | Hafta 2 sonu |
| Blog sayfaları | `/api/posts` | Hafta 3 sonu |
| Quiz ekranları | `/api/quizzes` | Hafta 4 ortası |
| Leaderboard & Dashboard | `/api/leaderboard`, `/api/users/me/dashboard` | Hafta 5 ortası |
| Admin Paneli UI | `/api/admin/*` | Hafta 5 sonu |

> Endpoint'ler hazır olana kadar frontend **mock veri** ile çalışır; beklenmez.

---

## 4. Çalışma Düzeni

### Toplantılar

| Toplantı | Sıklık | Süre | Katılım |
|---|---|---|---|
| Kısa durum toplantısı (Dün ne yaptım / Bugün ne yapacağım / Engelim var mı) | Haftada 3 gün (online) | 15 dk | Herkes |
| Haftalık planlama & demo | Her hafta başı | 45 dk | Herkes |
| Frontend eşlikli çalışma | Haftada 1–2 | 1 saat | Ümmügülsüm + Aleyna |
| Backend kod inceleme / mentörlük | Haftada 1 | 1 saat | Alp + backend ekibi |

### Görev Takibi

- **GitHub Projects** (Kanban): `Yapılacak` → `Devam Ediyor` → `İncelemede` → `Tamamlandı`
- Her görev bir **GitHub Issue** olarak açılır; etiketler: `frontend`, `backend`, `data`, `bug`, `güvenlik`, `admin`.
- Her issue'nun tek bir sorumlusu olur.

### Git Dal Stratejisi

```
main        → canlı site (yalnızca Alp birleştirir)
develop     → test ortamı
feature/*   → yeni özellik  (ör. feature/blog-onay-paneli)
fix/*       → hata düzeltme
```

- Doğrudan `main` veya `develop`'a push **yasak**; her şey Pull Request ile.
- Frontend PR'ları → Ümmügülsüm inceler. Backend PR'ları → Alp inceler (veya başka bir backend üyesi).
- Commit formatı: `feat: blog onay endpoint'i eklendi`, `fix: leaderboard haftalık filtre hatası`.

---

## 5. Riskler ve Önlemler

| Risk | Olasılık | Önlem |
|---|---|---|
| 6 hafta süre yetmeyebilir | Orta | Önce **MVP** (kayıt, blog, quiz, leaderboard, admin onay); ekstralar sonraya |
| Aleyna'nın deneyimsizliği | Orta | Küçük görevler, eşlikli çalışma, dokümantasyon |
| Frontend–Backend uyumsuzluğu | Orta | API sözleşmesi Hafta 1'de dondurulur, ortak Zod şemaları |
| Güvenlik açıkları | Orta | Güvenlik kontrol listesi, bağımlılık taraması, admin E2E testleri |
| Alp'e tek nokta bağımlılığı (deploy) | Düşük | Deploy adımları README'ye yazılır; Furkan yedek sorumlu olarak eğitilir |
| Vibecoding ile üretilen hatalı kod | Orta | AI ile yazılan her kod bir ekip üyesi tarafından okunur ve test edilir |

---

## 6. MVP Kapsamı (Hafta 6 sonunda mutlaka hazır olacaklar)

- [ ] Kayıt → admin onayı → giriş
- [ ] Blog yazısı gönderme → admin onayı → yayın
- [ ] Admin'in kategorili quiz oluşturması, üyelerin çözmesi
- [ ] Günlük / haftalık / aylık leaderboard
- [ ] Profil ve dashboard
- [ ] Ban / kısıtlama
- [ ] Şifremi unuttum
- [ ] Canlı ortamda HTTPS + WAF

### Sonraki Sürüm (v2) Fikirleri

- Zamanlı yarışma modu (canlı quiz), rozet/başarım sistemi
- Yazılara yorum ve beğeni
- HSD toplulukları arası takım sıralaması
- Bildirim sistemi
