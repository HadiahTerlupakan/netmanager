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

## 4. Aturan .cursor/rules atau .github/copilot-instructions.md

Tidak ada file `rules` Cursor atau `copilot-instructions.md` yang ditemukan di repositori ini.

---

Dengan mematuhi panduan ini, agen dapat berkontribusi secara efektif dan konsisten dengan *codebase* proyek.
