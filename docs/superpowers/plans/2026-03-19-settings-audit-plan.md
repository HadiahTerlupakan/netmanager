# Audit Menu Pengaturan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melakukan audit fungsional, keamanan, dan UI/UX pada 11 sub-menu pengaturan di panel admin.

**Architecture:** Audit dilakukan secara paralel menggunakan sub-agent spesialis (UI/UX, Security, Permissions) dengan pelaporan terpusat di `docs/audits/settings-audit-report.md`.

**Tech Stack:** Next.js (App Router), Prisma, Shadcn UI, Zod.

---

### Task 1: Audit UI/UX & Konsistensi Komponen
**Files:**
- Audit: `app/admin/pengaturan/**/*.tsx`
- Ref: `components/ui/`

- [ ] **Step 1: Identifikasi Inkonsistensi UI**
Gunakan sub-agent `generalist` untuk scan semua file di `app/admin/pengaturan` guna mencari penggunaan inline styles, komponen non-shadcn, atau missing loading states.
- [ ] **Step 2: Verifikasi Responsive Design**
Pastikan semua form di sub-menu pengaturan menggunakan grid/flex yang benar untuk tampilan mobile.
- [ ] **Step 3: Catat Temuan UI/UX**
Tulis temuan ke `docs/audits/settings-audit-report.md` bagian UI/UX.

### Task 2: Audit Keamanan & Integrasi Database
**Files:**
- Audit: `app/api/settings/route.ts` (jika ada) atau server actions terkait.
- Audit: `prisma/schema.prisma`

- [ ] **Step 1: Verifikasi Enkripsi Data Sensitif**
Gunakan `codebase_investigator` untuk melacak field password/API Key (WhatsApp, Email, Payment) dan pastikan menggunakan `encrypted: true` di model `Settings`.
- [ ] **Step 2: Audit Isolasi Tenant**
Pastikan setiap query ke model `Settings` menyertakan `where: { tenantId }`.
- [ ] **Step 3: Validasi Form (Server-side)**
Pastikan semua mutasi data divalidasi dengan Zod schema yang sesuai.

### Task 3: Audit Izin & Akses (RBAC)
**Files:**
- Audit: `lib/permission-config.ts`
- Audit: `lib/menu-config.ts`

- [ ] **Step 1: Cek Pemetaan Permission**
Pastikan setiap sub-menu memiliki permission code yang unik dan terdaftar di `permission-config.ts`.
- [ ] **Step 2: Verifikasi Route Protection**
Pastikan middleware atau layout pembungkus memeriksa izin sebelum merender konten sub-menu.

### Task 4: Konsolidasi & Rekomendasi
- [ ] **Step 1: Finalisasi Laporan Audit**
Rangkum semua temuan (Bug, Security Risk, UX Improvement).
- [ ] **Step 2: Usulkan Perbaikan (Action Plan)**
Buat tiket perbaikan untuk setiap temuan kritikal.
