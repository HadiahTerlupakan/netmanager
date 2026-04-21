# AGENTS.md - Panduan untuk Agen Pemrograman

Dokumen ini berfungsi sebagai panduan komprehensif bagi agen pemrograman yang beroperasi di repositori ini. Tujuannya adalah untuk memastikan konsistensi, efisiensi, dan kepatuhan terhadap praktik terbaik proyek.

## 1. Perintah Build, Lint, dan Test

Gunakan `npm` sebagai manajer paket utama.

### 1.1. Perintah Dasar

-   **Install Dependencies**: `npm install`
-   **Build Proyek**: `npm run build`
-   **Start Production Server**: `npm start`
-   **Check Kode (Lint + Typecheck + Build)**: `npm run check`

### 1.2. Linting & Type-Checking

-   **Jalankan Linter**: `npm run lint`
    -   *Perbaikan Otomatis*: `npm run lint -- --fix` (jika didukung oleh konfigurasi linter)
-   **Jalankan Type-Checker**: `npm run typecheck`

### 1.3. Perintah Testing

-   **Setup Test Database**: `bash ./scripts/setup-test-db.sh`
    -   **PENTING**: Ini harus dijalankan sebelum menjalankan tes.
-   **Unit/Integration Tests (Watch Mode)**: `npm test`
    -   Digunakan selama pengembangan aktif untuk memantau perubahan file.
-   **Unit/Integration Tests (Single Run)**: `npm run test:run`
    -   Digunakan untuk menjalankan semua tes sekali, cocok untuk CI/CD atau verifikasi akhir.
-   **Test Coverage Report**: `npm run test:coverage`
-   **End-to-End (E2E) Tests (Playwright)**: `npm run test:e2e`
-   **E2E Tests dengan UI (Playwright)**: `npm run test:e2e:ui`

**Menjalankan Single Test:**
Untuk menjalankan satu tes atau subset tes, framework pengujian yang digunakan kemungkinan adalah Jest atau serupa. Anda bisa mencoba:
-   `npm test -- <path/to/your/test/file.test.ts>`
-   `npm test -- -t "nama_test_spesifik"` (menjalankan tes dengan nama yang cocok)
-   Konsultasikan dokumentasi Jest atau konfigurasi `package.json` untuk opsi lebih lanjut.

## 2. Panduan Gaya Kode & Konvensi

Proyek ini menggunakan TypeScript, Tailwind CSS, dan Prisma ORM dengan arsitektur Modular Monolith.

### 2.1. Arsitektur Modular Monolith

-   **Struktur Lapisan**: UI (Next.js App Router) -> API (Thin) -> Service -> Repository -> Database.
-   **Enkapsulasi Modul**: Modul berkomunikasi hanya melalui API publik mereka (`index.ts`). **Jangan** mengakses repositori modul lain secara langsung; gunakan Service mereka.
-   **Thin API Routes**: Rute API harus ringan, fokus pada parsing permintaan dan memanggil Service yang relevan. Logika bisnis harus berada di lapisan Service.
-   **Path Aliases**: Gunakan `@/` untuk impor. Contoh: `@/components`, `@/lib`, `@/modules`.

### 2.2. TypeScript & Type Safety

-   **Selalu Gunakan Tipe**: Pastikan semua variabel, argumen fungsi, dan nilai kembalian memiliki tipe yang eksplisit. Hindari `any` sebisa mungkin.
-   **Interfaces & Types**: Gunakan `interface` untuk bentuk objek (object shapes) dan `type` untuk alias tipe kompleks atau union/intersection types.
-   **Validasi**: Zod digunakan untuk validasi skema (API input, form). Pastikan untuk menggunakan validasi yang memadai.

### 2.3. Imports & Formatting

-   **Urutan Import**:
    1.  Node.js built-in modules (misalnya `path`, `fs`)
    2.  Third-party libraries (misalnya `react`, `next`, `axios`)
    3.  Internal modules (menggunakan alias `@/`, misalnya `@/modules`, `@/lib`)
    4.  Relative imports (misalnya `./components`)
    5.  CSS/Styling imports
-   **Penataan Format Otomatis**: Gunakan Prettier atau tool format yang dikonfigurasi proyek. Jalankan `npm run lint` untuk memperbaiki masalah format secara otomatis jika diizinkan.

### 2.4. Naming Conventions

-   **CamelCase**: Untuk variabel, properti, fungsi, dan nama file (`myVariable`, `myFunction`, `myFile.ts`).
-   **PascalCase**: Untuk komponen React, kelas, dan antarmuka (`MyComponent`, `MyClass`, `MyInterface`).
-   **SCREAMING_SNAKE_CASE**: Untuk konstanta global atau enum (`MY_CONSTANT`, `OrderStatus.PENDING`).
-   **Schema Prisma**: Ikuti konvensi penamaan Prisma (PascalCase untuk model, camelCase untuk field).

### 2.5. Error Handling

-   **Pusatkan Error Handling**: Jika ada pola umum, gunakan mekanisme error handling terpusat (misalnya, middleware untuk API routes).
-   **Error Spesifik**: Lemparkan (throw) error yang spesifik (misalnya, `ValidationError`, `NotFoundError`) daripada error generik.
-   **Logging**: Pastikan error dicatat dengan benar dengan informasi konteks yang cukup.

### 2.6. Komentar

-   **Komentar Penjelasan**: Tambahkan komentar untuk menjelaskan *mengapa* kode tertentu dilakukan, terutama untuk logika yang kompleks atau tidak jelas. Hindari mengomentari *apa* yang sudah jelas dari kode.
-   **JSDoc**: Gunakan JSDoc untuk mendokumentasikan fungsi, kelas, dan antarmuka, terutama untuk API publik modul atau komponen yang dapat digunakan ulang.

## 3. Tooling Tambahan

-   **Prisma**: Gunakan `npm run prisma:generate` setelah setiap perubahan `prisma/schema.prisma`.
-   **`tsx`**: Untuk menjalankan skrip TypeScript secara langsung (`npx tsx scripts/myscript.ts`).

## 4. Database & Prisma Migrations

Proyek ini menggunakan **4 database PostgreSQL** terpisah, masing-masing dengan konfigurasi Prisma sendiri:

| Database | Schema File | Config File | Migrations Folder |
|---|---|---|---|
| `netmanager` | `prisma/schema.prisma` | `prisma.config.ts` | `prisma/migrations/` |
| `radius` | `prisma/schema.radius.prisma` | `prisma.radius.config.ts` | `prisma/radius_migrations/` |
| `billing` | `prisma/billing.prisma` | `prisma.billing.config.ts` | `prisma/billing_migrations/` |
| `mitra` | `prisma/mitra.prisma` | `prisma.mitra.config.ts` | `prisma/mitra_migrations/` |

### 4.1. Membuat Migrasi Baru

```bash
# Netmanager (default)
npx prisma migrate dev --name nama_migrasi

# Database lain (gunakan --config)
npx prisma migrate dev --name nama_migrasi --config=prisma.radius.config.ts
npx prisma migrate dev --name nama_migrasi --config=prisma.billing.config.ts
npx prisma migrate dev --name nama_migrasi --config=prisma.mitra.config.ts
```

Setelah setiap perubahan schema, jalankan: `npm run prisma:generate`

### 4.2. Safe Migration Guard (`@safe-guard-ack`)

Pipeline CI/CD (Jenkins) memiliki **safe-guard** yang otomatis memblokir migrasi destructive (DROP TABLE, DROP COLUMN, TRUNCATE, ALTER COLUMN) untuk mencegah kehilangan data yang tidak disengaja.

**Jika Anda SENGAJA membuat migrasi destructive**, tambahkan komentar acknowledgment di **baris pertama** file `migration.sql`:

```sql
-- @safe-guard-ack: Alasan mengapa migrasi destructive ini aman dan disengaja
-- DropTable
DROP TABLE "nama_tabel";
```

**Aturan:**
-   **Tanpa `@safe-guard-ack`**: Pipeline akan **DIBLOKIR** dan deployment gagal.
-   **Dengan `@safe-guard-ack`**: Pipeline akan **LOLOS** dengan log alasan ke console.
-   Komentar harus mengandung teks `-- @safe-guard-ack:` diikuti alasan yang jelas.
-   Implementasi guard ada di `k8s/migration-job.yaml`.

### 4.3. Squashing Migrations (Reset History)

Jika riwayat migrasi terlalu banyak dan perlu di-squash:

1.  **Jangan gabungkan schema baru ke dalam file squash**. File squash (`init`) harus 100% merepresentasikan kondisi database **yang sudah ada** di staging/production.
2.  Perubahan schema baru harus diletakkan di file migrasi **terpisah** setelah init.
3.  Update `k8s/migration-job.yaml` untuk:
    -   Menghapus record migrasi lama dari tabel `_prisma_migrations` (via `psql`).
    -   Menjalankan `npx prisma migrate resolve --applied <nama_init>` untuk menandai baseline sebagai sudah ter-apply.
    -   Menjalankan `npx prisma migrate deploy` untuk menerapkan migrasi baru.
4.  **Setelah deployment pertama berhasil**, hapus kode pembersihan one-time dari `migration-job.yaml`.

### 4.4. Deployment Flow (Jenkins → K8s)

File: `k8s/migration-job.yaml`

Urutan eksekusi:
1.  🧹 Bersihkan record migrasi lama (jika ada squash reset)
2.  🛡️ Safe Migration Guard — cek migrasi destructive
3.  🚀 Resolve baseline + Deploy migrasi baru untuk keempat database

## 5. Aturan .cursor/rules atau .github/copilot-instructions.md

Tidak ada file `rules` Cursor atau `copilot-instructions.md` yang ditemukan di repositori ini.

---

Dengan mematuhi panduan ini, agen dapat berkontribusi secara efektif dan konsisten dengan *codebase* proyek.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
