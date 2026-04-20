# NetManager

![CI/CD Pipeline](https://github.com/HadiahTerlupakan/netmanager/actions/workflows/ci.yml/badge.svg)

Aplikasi manajemen jaringan FTTH (Fiber to the Home) yang dibangun dengan Next.js, TypeScript, Prisma, dan PostgreSQL.

## 📋 Persyaratan

Sebelum menjalankan aplikasi, pastikan Anda telah menginstall:

- **Node.js** (versi 18 atau lebih tinggi)
- **npm** atau **yarn**
- **Docker** dan **Docker Compose** (atau **Colima** untuk macOS)
- **Git**

### Untuk macOS

Jika menggunakan macOS, install **Colima** sebagai Docker runtime:

```bash
brew install colima
```

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone <repository-url>
cd netmanager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di root direktori. Anda bisa mulai dari `.env.production.example`, lalu sesuaikan untuk lokal:

```bash
cp .env.production.example .env
```

Isi minimal konfigurasi berikut:

```env
# Database
DATABASE_URL="postgresql://netmgr:netmgr@localhost:5433/netmanager"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-16-characters"

# Firebase browser (build-time / client)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyDihrl023fOQnXf8oZ7A2rU7YxzJzQN5Lc"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="netmanager-96742.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="netmanager-96742"
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="netmanager-96742.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="43187781340"
NEXT_PUBLIC_FIREBASE_APP_ID="1:43187781340:web:461fc10875b35538e67e19"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<firebase-web-push-public-key>"

# Firebase admin (runtime / server)
FIREBASE_PROJECT_ID="netmanager-96742"
FIREBASE_CLIENT_EMAIL="<firebase-service-account-email>"
FIREBASE_PRIVATE_KEY="<firebase-private-key-dengan-escaped-newline>"
FIREBASE_DATABASE_URL="https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app"

# Node Environment
NODE_ENV="development"
```

**Catatan:** Ganti `NEXTAUTH_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY` dengan nilai environment Anda.

### 4. Setup Database

#### a. Jalankan Docker Services (PostgreSQL & Redis)

**Untuk macOS dengan Colima:**

```bash
# Jalankan Colima (jika belum berjalan)
colima start

# Jalankan database dan Redis
npm run db:up
```

**Untuk Linux/Windows dengan Docker:**

```bash
docker-compose up -d
```

#### b. Setup Firebase untuk Browser dan Runtime

Aplikasi memakai dua jalur konfigurasi Firebase:

- **Browser / build-time**: `NEXT_PUBLIC_FIREBASE_*` dan `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **Server / runtime**: `FIREBASE_*`

Flow-nya seperti ini:

1. `lib/firebase/config.ts` membangun Firebase client browser dari env `NEXT_PUBLIC_FIREBASE_*`.
2. Jika ada nilai kosong, `null`, atau `undefined`, aplikasi fallback ke config web default yang tersimpan di `lib/firebase/browserConfig.ts`.
3. Realtime Database browser memakai `NEXT_PUBLIC_FIREBASE_DATABASE_URL`, jadi tidak lagi menebak URL dari `projectId`.
4. Firebase Admin di server tetap memakai `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, dan opsional `FIREBASE_DATABASE_URL`.
5. Untuk staging/production, semua `NEXT_PUBLIC_FIREBASE_*` harus masuk saat build image karena nilainya dibundle oleh Next.js pada saat `npm run build`.

Referensi nilai browser yang saat ini dipakai:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyDihrl023fOQnXf8oZ7A2rU7YxzJzQN5Lc"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="netmanager-96742.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="netmanager-96742"
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://netmanager-96742-default-rtdb.asia-southeast1.firebasedatabase.app"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="netmanager-96742.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="43187781340"
NEXT_PUBLIC_FIREBASE_APP_ID="1:43187781340:web:461fc10875b35538e67e19"
```

#### c. Push Multi-Database Schemas

Aplikasi menggunakan lebih dari 1 schema database (Utama, Radius, Billing, Mitra). Tambahkan ke seluruh database:

```bash
npm run prisma:push-all
```

#### d. Generate Prisma Client

```bash
npm run prisma:generate
```

#### e. Seed Database (Recommended)

```bash
npm run prisma:seed
```

Ini akan membuat user admin default:
- **Email:** `admin@example.com` (atau dari `SEED_ADMIN_EMAIL` di `.env`)
- **Password:** `admin123` (atau dari `SEED_ADMIN_PASSWORD` di `.env`)
- **Role:** `ADMIN`

**Catatan:** Seed script adalah idempotent - bisa dijalankan berkali-kali tanpa error. Jika user sudah ada, akan di-update.

Lihat dokumentasi lengkap di [`docs/SEED_DATABASE.md`](docs/SEED_DATABASE.md)

### 5. Verifikasi Services

Pastikan semua service berjalan dengan baik:

```bash
# Cek status Docker containers
npm run db:ps
```

Anda seharusnya melihat:
- `netmanager-postgres` - Status: Up (healthy)
- `netmanager-redis` - Status: Up

## 🏃 Menjalankan Aplikasi

### Development Mode

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

#### Akses dengan Subdomain (Development)

Aplikasi mendukung routing berbasis subdomain untuk memisahkan admin dan pelanggan:

- **Admin**: `http://admin.localhost:3000` atau `http://admin.netmanager.local:3000`
- **Pelanggan**: `http://pelanggan.localhost:3000` atau `http://pelanggan.netmanager.local:3000`

**Catatan:** 
- Next.js mendukung `*.localhost` secara native, jadi `admin.localhost:3000` langsung bekerja tanpa konfigurasi tambahan
- Jika `*.localhost` tidak bekerja, gunakan custom domain dengan mengedit hosts file (lihat dokumentasi lengkap di [`docs/SUBDOMAIN_SETUP.md`](docs/SUBDOMAIN_SETUP.md))

### Production Build

```bash
# Build aplikasi
npm run build

# Jalankan production server
npm start
```

## 📜 Scripts yang Tersedia

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Menjalankan aplikasi dalam mode development |
| `npm run build` | Build aplikasi untuk production |
| `npm start` | Menjalankan aplikasi dalam mode production |
| `npm run lint` | Menjalankan ESLint |
| `npm run typecheck` | Menjalankan TypeScript type checking |
| `npm run check` | Menjalankan lint, typecheck, dan build |
| `npm run db:up` | Menjalankan database dan Redis (Docker) |
| `npm run db:down` | Menghentikan database dan Redis |
| `npm run db:ps` | Menampilkan status Docker containers |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Menjalankan database migrations |
| `npm run prisma:seed` | Menjalankan database seeding |
| `npm run prisma:baseline` | Baseline migration (fix drift) |
| `npm run prisma:sync` | Sync schema dan baseline migration |
| `npm run prisma:fix-drift` | Fix drift dengan membuat migration baru yang lengkap |
| `npm test` | Menjalankan tests (watch mode) |
| `npm run test:run` | Menjalankan tests sekali |
| `npm run test:ui` | Menjalankan tests dengan UI |
| `npm run test:coverage` | Menjalankan tests dengan coverage report |
| `./scripts/setup-test-db.sh` | Setup test database terpisah (PENTING!) |

## 🗄️ Database & Services

### PostgreSQL

- **Port:** `5433`
- **User:** `netmgr` (default)
- **Password:** `netmgr` (default)
- **Database:** `netmanager` (default)

Konfigurasi dapat diubah melalui environment variables di `docker-compose.yml` atau file `.env`.

### Redis

- **Port:** `6379`
- **URL:** `redis://localhost:6379`
- **Catatan:** Redis dipakai untuk cache, rate limiting, cron locking, idempotency, dan queue processing. Untuk production, set `REDIS_URL` secara eksplisit melalui secret/env deployment.

### FreeRADIUS

- **Port Authentication:** 
  - Docker Compose: `1812/udp`
  - Kubernetes Staging: `31812/udp` (NodePort)
  - Kubernetes Production: `30812/udp` (NodePort)
- **Port Accounting:** 
  - Docker Compose: `1813/udp`
  - Kubernetes Staging: `31813/udp` (NodePort)
  - Kubernetes Production: `30813/udp` (NodePort)
- **Purpose:** PPPoE authentication and accounting for customer internet access.
- **Configuration:** `config/radius/`
- **Documentation:** Lihat panduan lengkap di [docs/RADIUS_INTEGRATION.md](docs/RADIUS_INTEGRATION.md)

## 🧪 Testing

Aplikasi menggunakan Vitest untuk unit tests dan integration tests.

### ⚠️ PENTING: Setup Test Database Terpisah

**Sebelum menjalankan tests, setup test database terpisah untuk menghindari kehilangan data development:**

```bash
# Setup test database (hanya sekali)
./scripts/setup-test-db.sh
```

Script ini akan:
- Membuat database `netmanager_test` terpisah
- Menambahkan `TEST_DATABASE_URL` ke `.env`
- Menjalankan migrations di test database

**Mengapa penting?**
- Tests akan menghapus semua data setelah selesai (cleanup)
- Tanpa test database terpisah, data development Anda akan terhapus!

Lihat dokumentasi lengkap di [`docs/DATABASE_DATA_LOSS_FIX.md`](docs/DATABASE_DATA_LOSS_FIX.md)

### Menjalankan Tests

```bash
# Watch mode (development)
npm test

# Run sekali
npm run test:run

# Dengan UI
npm run test:ui

# Dengan coverage report
npm run test:coverage
```

### Test Coverage

- Unit tests untuk utilities dan middleware
- Integration tests untuk API endpoints
- Test database otomatis di-setup untuk CI/CD

Lihat dokumentasi lengkap di [`docs/INTEGRATION_TESTS.md`](docs/INTEGRATION_TESTS.md)

## 🔄 CI/CD Pipeline

Aplikasi menggunakan GitHub Actions untuk Continuous Integration dan Continuous Deployment.

### Automated Checks

Setiap push dan pull request akan otomatis menjalankan:
- ✅ Linting (ESLint)
- ✅ Type checking (TypeScript)
- ✅ Unit & Integration tests
- ✅ Build verification
- ✅ Security audit

### Workflows

- **CI Pipeline** - Automated checks pada setiap push/PR
- **Release Pipeline** - Automated release saat tag dibuat
- **Deploy Pipeline** - Deployment ke staging/production

Lihat dokumentasi lengkap di [`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md)

### 🚀 Deployment ke Production

Aplikasi ini menggunakan sistem deployment berbasis branch melalui Jenkins:
- Branch `staging` -> Otomatis deploy ke namespace `netmanager-staging`.
- Branch `main` -> Otomatis deploy ke namespace `netmanager-production`.

#### Menggunakan Terminal (Otomatis)
Tersedia script `deploy-prod.sh` untuk melakukan sinkronisasi dari `staging` ke `main` dengan satu perintah:

```bash
# Memberikan izin eksekusi (hanya sekali)
chmod +x deploy-prod.sh

# Menjalankan deployment ke production
./deploy-prod.sh
```

Script ini akan otomatis melakukan:
1. Commit & Push sisa perubahan di branch `staging`.
2. Merge `staging` ke branch `main`.
3. Push ke branch `main` (memicu pipeline Jenkins Production).
4. Kembali ke branch `staging`.

## 🛠️ Teknologi yang Digunakan

- **Framework:** Next.js 16
- **Language:** TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Cache:** Redis
- **Authentication:** NextAuth.js
- **Styling:** Tailwind CSS
- **Form Handling:** React Hook Form + Zod
- **Maps:** OpenLayers (ol)
- **Testing:** Vitest, React Testing Library
- **CI/CD:** GitHub Actions

## 📁 Struktur Proyek

```
netmanager/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── admin/             # Admin pages
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Utilities & services
│   ├── repositories/      # Data access layer
│   ├── services/          # Business logic
│   └── validations/       # Zod schemas
├── prisma/                # Prisma schema & migrations
└── public/                # Static files
```

## 🔧 Troubleshooting

### Colima tidak berjalan (macOS)

```bash
colima start
```

### Docker containers tidak berjalan

```bash
# Cek status
npm run db:ps

# Restart containers
npm run db:down
npm run db:up
```

### Database connection error

1. Pastikan PostgreSQL container berjalan: `npm run db:ps`
2. Periksa `DATABASE_URL` di file `.env`
3. Pastikan port `5433` tidak digunakan aplikasi lain

### Prisma Client tidak ter-generate

```bash
npm run prisma:generate
```

### Prisma Migration Drift (Database tidak sinkron dengan migration history)

Jika Anda melihat error "Drift detected" saat menjalankan `prisma migrate dev`, ini berarti database schema tidak sinkron dengan migration history. Ini biasanya terjadi karena menggunakan `prisma db push` yang tidak membuat migration file.

**Solusi 1: Baseline migration (jika database sudah memiliki data penting)**

```bash
# Sync schema tanpa membuat migration baru
npx prisma db push

# Mark migration sebagai sudah di-apply
npm run prisma:baseline
```

**Solusi 2: Reset database (jika data bisa dihapus)**

```bash
# Reset database dan jalankan migration dari awal
npm run prisma:reset-seed
```

**Solusi 3: Sync dan baseline otomatis**

```bash
# Sync schema dan baseline migration sekaligus
npm run prisma:sync
```

**Solusi 4: Fix drift dengan membuat migration baru (jika migration file tidak lengkap)**

Jika migration file tidak lengkap (hanya berisi beberapa tabel, tapi database sudah punya semua tabel):

```bash
# Mark migration lama sebagai rolled back, lalu buat migration baru yang lengkap
npm run prisma:fix-drift
```

**Catatan:** 
- Gunakan `prisma migrate dev` untuk development (membuat migration file)
- Gunakan `prisma db push` hanya untuk prototyping cepat
- Jangan gunakan `prisma db push` di production!
- Jika migration file tidak lengkap, gunakan `prisma:fix-drift` untuk membuat migration baru yang lengkap

### Port sudah digunakan

Jika port `3000`, `5433`, atau `6380` sudah digunakan:

1. **Port 3000 (Next.js):** Ubah di `package.json` script `dev` menjadi `next dev -p <port-lain>`
2. **Port 5433 (PostgreSQL):** Ubah di `docker-compose.yml` bagian `ports`
3. **Port 6380 (Redis):** Ubah di `docker-compose.yml` bagian `ports`

## 📝 Catatan Penting

- Pastikan Colima (macOS) atau Docker berjalan sebelum menjalankan database
- File `.env` tidak di-commit ke repository (harus dibuat manual)
- Database migrations harus dijalankan setelah clone repository
- Untuk production, pastikan semua environment variables sudah dikonfigurasi dengan benar

## 📚 Dokumentasi

- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) - API Documentation (Swagger/OpenAPI)
- [`docs/SUBDOMAIN_SETUP.md`](docs/SUBDOMAIN_SETUP.md) - Setup Subdomain untuk Development dan Production
- [`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md) - CI/CD Pipeline Documentation
- [`docs/INTEGRATION_TESTS.md`](docs/INTEGRATION_TESTS.md) - Integration Tests Documentation
- [`docs/BACKUP_STRATEGY.md`](docs/BACKUP_STRATEGY.md) - Database Backup Strategy
- [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) - Implementation Guide
- [`STATUS_IMPLEMENTASI.md`](STATUS_IMPLEMENTASI.md) - Implementation Status

## 🤝 Kontribusi

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

**Catatan:** Semua PR akan otomatis di-check oleh CI/CD pipeline. Pastikan semua tests pass sebelum merge.

## 📄 Lisensi

ISC

