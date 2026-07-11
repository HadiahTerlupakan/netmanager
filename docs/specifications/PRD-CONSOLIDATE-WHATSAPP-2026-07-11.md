# PRD: Konsolidasi Sistem WhatsApp menjadi Single Source of Truth

| Field | Value |
|-------|-------|
| **ID** | PRD-WHATSAPP-CONSOLIDATION |
| **Tanggal** | 2026-07-11 |
| **Author** | agent |
| **Status** | Draft — Menunggu eksekusi |
| **Scope** | `modules/notification`, `modules/settings`, `app/api/admin/whatsapp`, `app/api/admin/settings/whatsapp` |

---

## 1. Latar Belakang

Sistem WhatsApp saat ini memiliki **dua implementasi paralel** yang menyimpan
konfigurasi di tempat berbeda dan dipakai oleh caller berbeda. Ini menyebabkan:

1. **Kebingungan pengguna**: Admin mengisi API key di halaman
   `/admin/pengaturan/whatsapp` (sistem baru), tapi notifikasi otomatis tetap
   gagal karena membaca dari sistem lama yang kosong.
2. **Duplikasi data**: Konfigurasi WhatsApp tersebar di dua tabel (`Settings`
   key-value dan `WhatsAppAccount`).
3. **Maintenance ganda**: Dua service, dua endpoint API, dua UI path, dua
   alur enkripsi/dekripsi API key.
4. **Bug tersembunyi**: `WhatsAppService.testConnection()` mengirim API key
   terenkripsi ke provider (sudah diperbaiki sebagian, tapi root cause-nya
   adalah duplikasi yang membuat developer bingung).

### 1.1 Sistem Lama (akan dihapus)

| Komponen | Lokasi | Status |
|----------|--------|--------|
| Storage | `Settings` table, keys: `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY`, `WABLAS_DOMAIN`, `WABLAS_DEVICE_ID` | Duplikat |
| Service | `modules/notification/services/whatsapp/whatsapp-service.ts` (`WhatsAppService`) | Dipakai caller lama |
| Settings service | `modules/settings/services/whatsappSettings.ts` | Dead code setelah migrasi |
| API endpoint | `app/api/admin/settings/whatsapp/route.ts` (GET/PUT/POST) | Tidak dipakai UI |
| Migrasi script | `scripts/migrate-whatsapp-settings.ts` | Dipakai sekali untuk migrasi data |

### 1.2 Sistem Baru (akan jadi SOT)

| Komponen | Lokasi | Status |
|----------|--------|--------|
| Storage | `WhatsAppAccount` table (multi-akun, tenant-scoped) | Aktif |
| Service (CRUD) | `modules/notification/services/whatsapp-account.service.ts` (`WhatsAppAccountService`) | Aktif |
| Service (kirim) | `modules/notification/services/whatsapp-sender.service.ts` (`WhatsAppSenderService`) | Aktif |
| API endpoint | `app/api/admin/whatsapp/accounts/*`, `app/api/internal/whatsapp/send` | Aktif |
| UI | `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx` (modal multi-akun) | Aktif |

### 1.3 Caller saat ini

**Caller `WhatsAppService` (sistem lama) — harus dipindahkan:**
- `modules/notification/services/NotificationDispatcher.ts:207` — kirim
  notifikasi billing ke pelanggan
- `modules/pelanggan/services/admin-support-ticket-reply.helpers.ts:37` —
  kirim reply ticket via WhatsApp
- `modules/settings/services/whatsappSettings.ts:123` — test connection
  (sudah dead code setelah endpoint lama dihapus)

**Caller `WhatsAppSenderService` (sistem baru) — sudah benar:**
- `app/api/admin/whatsapp/messages/route.ts:7`
- `app/api/admin/whatsapp/stats/route.ts:7`
- `app/api/internal/whatsapp/send/route.ts:10`
- `modules/notification/services/WhatsAppApprovalButtonService.ts:17`

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan

1. **Single source of truth**: Seluruh konfigurasi WhatsApp hanya di tabel
   `WhatsAppAccount`. Tidak ada konfigurasi di `Settings`.
2. **Satu jalur pengiriman**: Semua pengiriman pesan WhatsApp (notifikasi
   otomatis, broadcast, approval, test) lewat `WhatsAppSenderService`.
3. **Hapus dead code**: Endpoint, service, dan DTO lama dihapus sepenuhnya.
4. **Migrasi data**: Data lama di `Settings` dipindahkan ke `WhatsAppAccount`
   sebelum sistem lama dihapus.
5. **Zero downtime**: Migrasi dilakukan bertahap, tidak ada notifikasi yang
   gagal dikirim selama transisi.

### 2.2 Non-Tujuan

- Tidak mengubah UI `WhatsappSettingsClient.tsx` (sudah benar).
- Tidak mengubah schema `WhatsAppAccount` (sudah memenuhi kebutuhan).
- Tidak menambah provider baru (Wablas, Fonnte, MPWA tetap).
- Tidak mengubah mekanisme enkripsi API key (`encryptApiKey`/`decryptApiKey`
  di `lib/utils/encryption.ts` tetap dipakai).
- Tidak menyentuh sistem email atau push notification.

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Migrasi `WhatsAppService` ke baca dari `WhatsAppAccount`

`WhatsAppService` (sementara sebelum dihapus) harus membaca konfigurasi dari
`WhatsAppAccount` default untuk tenant, bukan dari `Settings`.

**Aturan prioritas sumber konfigurasi (fallback berurutan):**
1. `WhatsAppAccount` default (`isDefault=true`, `isActive=true`) untuk
   `tenantId` yang diberikan.
2. `WhatsAppAccount` aktif pertama untuk `tenantId` (jika tidak ada default).
3. Env var `FONNTE_API_KEY` / `WHATSAPP_PROVIDER` (backward compat untuk
   deployment lama yang belum migrasi).

**Catatan**: Setelah seluruh caller dipindahkan ke `WhatsAppSenderService`,
`WhatsAppService` akan dihapus (FR-4). FR-1 hanya sebagai jembatan transisi
agar tidak ada notifikasi yang gagal selama migrasi data berjalan.

#### FR-2: Pindahkan caller `WhatsAppService` ke `WhatsAppSenderService`

| Caller | Sebelum | Sesudah |
|--------|---------|---------|
| `NotificationDispatcher.sendWhatsApp()` | `new WhatsAppService(undefined, undefined, tenantId).sendMessage(...)` | `new WhatsAppSenderService().send({ phone, message, tenantId, accountType: "CUSTOMER" })` |
| `admin-support-ticket-reply.helpers.ts` | `new WhatsAppService().sendMessage(...)` | `new WhatsAppSenderService().send({ phone, message })` |

**Kontrak `WhatsAppSenderService.send()`:**
```typescript
send(options: {
  phone: string;
  message?: string;
  fileUrl?: string;
  accountId?: string;        // optional, auto-select jika kosong
  accountType?: "CUSTOMER" | "INTERNAL";  // optional, filter akun
  tenantId?: string;
}): Promise<SendResult>
```

`SendResult` sudah compatible dengan output `WhatsAppService.sendMessage()`:
```typescript
{ success: boolean; error?: string; messageId?: string; response?: unknown }
```

#### FR-3: Migrasi data dari `Settings` ke `WhatsAppAccount`

Script `scripts/migrate-whatsapp-settings.ts` sudah ada — perlu verifikasi
atau update agar:
1. Baca semua tenant yang punya `WHATSAPP_API_KEY` di `Settings`.
2. Buat `WhatsAppAccount` baru untuk tenant tersebut:
   - `name`: "Migrated (legacy)"
   - `phone`: env `WHATSAPP_TEST_PHONE` atau placeholder (admin edit nanti)
   - `provider`: dari `WHATSAPP_PROVIDER` (default `WABLAS`)
   - `apiKey`: dari `WHATSAPP_API_KEY` (didekripsi dulu, lalu dienkripsi ulang
     dengan format `WhatsAppAccount`)
   - `domain`: dari `WABLAS_DOMAIN`
   - `deviceId`: dari `WABLAS_DEVICE_ID`
   - `accountType`: `CUSTOMER` (default)
   - `isDefault`: `true` (akun pertama untuk tenant)
   - `isActive`: `true`
3. Idempoten: skip jika tenant sudah punya `WhatsAppAccount`.
4. Jalankan sekali sebelum sistem lama dihapus.

**Peringatan**: field `phone` wajib di `WhatsAppAccount` tapi tidak ada di
`Settings` lama. Script harus tetap membuat record dengan phone placeholder
(admin wajib edit setelah migrasi). Atau, jika tidak memungkinkan, skip tenant
dan lapor manual.

#### FR-4: Hapus sistem lama setelah migrasi

File yang dihapus setelah FR-1, FR-2, FR-3 selesai dan diverifikasi:

| File | Alasan |
|------|--------|
| `app/api/admin/settings/whatsapp/route.ts` | Endpoint lama, tidak dipakai UI |
| `modules/settings/services/whatsappSettings.ts` | Service lama, duplikat |
| `modules/notification/services/whatsapp/whatsapp-service.ts` | `WhatsAppService` diganti `WhatsAppSenderService` |
| Export `WhatsAppService` di `modules/notification/index.ts:111` | Follow-up penghapusan |

**Sebelum hapus, verifikasi:**
- `grep -rn "WhatsAppService" --include="*.ts" --include="*.tsx"` tidak ada
  hasil (kecuali `WhatsAppSenderService` / `WhatsAppAccountService`).
- `grep -rn "WHATSAPP_API_KEY\|WABLAS_DOMAIN\|WABLAS_DEVICE_ID" --include="*.ts"` 
  tidak ada hasil di kode produksi (hanya di script migrasi jika masih
  dipertahankan untuk referensi).

#### FR-5: Hapus keys lama dari `Settings` (opsional, terpisah)

Setelah migrasi data dan verifikasi berjalan 1 minggu (grace period):
- Hapus record `Settings` dengan key `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY`,
  `WABLAS_DOMAIN`, `WABLAS_DEVICE_ID` untuk semua tenant.
- Dilakukan via script terpisah, bukan migration Prisma (tidak ada perubahan
  schema, hanya data cleanup).

### 3.2 Non-Functional Requirements

#### NFR-1: Zero downtime
- Migrasi data (FR-3) berjalan tanpa henti server.
- Transisi caller (FR-2) dilakukan dalam satu commit, bukan bertahap per file,
  untuk menghindari inkonsistensi.

#### NFR-2: Backward compatibility selama transisi
- Selama FR-3 belum dijalankan, `WhatsAppService` tetap bisa baca dari
  `Settings` sebagai fallback (FR-1 prioritas sumber).
- Setelah FR-3 dijalankan dan FR-4 dieksekusi, fallback dihapus.

#### NFR-3: Tidak ada perubahan schema Prisma
- Tidak ada migration Prisma baru. Konsolidasi hanya di level kode dan data,
  bukan struktur tabel.
- `WhatsAppAccount` sudah punya semua field yang diperlukan.

#### NFR-4: Keamanan API key tetap terjaga
- API key tetap disimpan terenkripsi di `WhatsAppAccount.apiKey`.
- Dekripsi hanya terjadi di `WhatsAppSenderService.sendViaAccount()` dan
  `WhatsAppAccountService.testConnection()` (sudah diperbaiki).
- Tidak ada logger yang mencetak API key plain text.

#### NFR-5: Test coverage
- Business logic (`WhatsAppSenderService`, `WhatsAppAccountService`):
  minimum 70% coverage.
- Critical path (pengiriman notifikasi billing): minimum 90% coverage.
- Tambah test untuk: migrasi data idempotent, fallback konfigurasi, akun
  default selection.

---

## 4. Arsitektur Target

### 4.1 Dependency Flow (sebelum)

```
NotificationDispatcher ──→ WhatsAppService ──→ Settings (legacy)
admin-support-ticket   ──→ WhatsAppService ──→ Settings (legacy)

WhatsAppApprovalButton ──→ WhatsAppSenderService ──→ WhatsAppAccount
api/internal/whatsapp  ──→ WhatsAppSenderService ──→ WhatsAppAccount
api/admin/whatsapp/*   ──→ WhatsAppSenderService ──→ WhatsAppAccount
```

### 4.2 Dependency Flow (sesudah)

```
NotificationDispatcher    ──→ WhatsAppSenderService ──→ WhatsAppAccount
admin-support-ticket      ──→ WhatsAppSenderService ──→ WhatsAppAccount
WhatsAppApprovalButton    ──→ WhatsAppSenderService ──→ WhatsAppAccount
api/internal/whatsapp     ──→ WhatsAppSenderService ──→ WhatsAppAccount
api/admin/whatsapp/*      ──→ WhatsAppSenderService ──→ WhatsAppAccount

[HAPUS] WhatsAppService, Settings-based config, endpoint lama
```

### 4.3 Module Boundary (patuh Clean Architecture)

- `app/api/` (controller) → thin, hanya parse + call service + return DTO.
- `modules/notification/services/` → business logic.
- `modules/notification/repositories/` → data access.
- Tidak ada business logic di API route.
- Tidak ada query Prisma langsung di API route.

---

## 5. Acceptance Criteria

### AC-1: Notifikasi otomatis terkirim dari akun WhatsApp yang dikonfigurasi di UI
- **Given**: Admin menambah akun WhatsApp di `/admin/pengaturan/whatsapp`
  dengan provider Wablas, API key valid, domain `kudus.wablas.com`, set
  sebagai default.
- **When**: Sistem memicu notifikasi billing otomatis (invoice jatuh tempo,
  reminder PPPoE, dll).
- **Then**: Pesan terkirim melalui akun default tersebut, status `sent` di
  `WhatsAppMessage`, `dailyCount` akun bertambah.

### AC-2: Test Connection dari UI berhasil
- **Given**: Akun Wablas dengan API key valid sudah disimpan.
- **When**: Admin klik tombol Test Connection (ikon refresh).
- **Then**: Response `success: true`, pesan tes diterima di nomor akun.

### AC-3: Migrasi data idempoten
- **Given**: Tenant A punya `WHATSAPP_API_KEY` di `Settings`, belum punya
  `WhatsAppAccount`.
- **When**: Script migrasi dijalankan.
- **Then**: `WhatsAppAccount` baru dibuat untuk Tenant A, `isDefault=true`.
- **When**: Script dijalankan kedua kalinya.
- **Then**: Tidak ada `WhatsAppAccount` baru dibuat (idempotent).

### AC-4: Tidak ada referensi sistem lama di kode
- **Given**: FR-1 sampai FR-4 selesai.
- **When**: Jalankan `grep -rn "WhatsAppService\b" --include="*.ts"` di
  repo (kecuali `WhatsAppSenderService`, `WhatsAppAccountService`).
- **Then**: Tidak ada hasil.
- **When**: Jalankan `grep -rn "WHATSAPP_API_KEY" --include="*.ts"` di kode
  produksi.
- **Then**: Tidak ada hasil (hanya di script migrasi jika dipertahankan).

### AC-5: Build dan test lulus
- `npm run check` (lint + typecheck + build) lulus tanpa error.
- `npm run test:run` lulus, coverage business logic ≥ 70%, critical path ≥ 90%.

---

## 6. Implementation Plan (urutan eksekusi)

> Eksekusi dilakukan dalam **satu PR**, dengan commit terpisah per fase untuk
> memudahkan review. Tidak ada implementasi parsial yang dideploy ke produksi.

### Fase 1: Persiapan (non-breaking)
1. **Update `WhatsAppService.loadConfig()`** — baca dari `WhatsAppAccount`
   default, fallback ke `Settings` lama (FR-1).
   - File: `modules/notification/services/whatsapp/whatsapp-service.ts`
   - Inject `WhatsAppAccountRepository` ke constructor (optional, untuk
     testability).
2. **Tambah test** untuk fallback konfigurasi (FR-1).

### Fase 2: Pindahkan caller (non-breaking)
3. **Update `NotificationDispatcher.sendWhatsApp()`** — ganti
   `WhatsAppService` dengan `WhatsAppSenderService` (FR-2).
   - File: `modules/notification/services/NotificationDispatcher.ts`
4. **Update `admin-support-ticket-reply.helpers.ts`** — ganti
   `WhatsAppService` dengan `WhatsAppSenderService` (FR-2).
   - File: `modules/pelanggan/services/admin-support-ticket-reply.helpers.ts`
5. **Verifikasi**: notifikasi otomatis terkirim dari akun yang dikonfigurasi
   (AC-1).

### Fase 3: Migrasi data (non-breaking)
6. **Verifikasi/update script** `scripts/migrate-whatsapp-settings.ts` agar
   idempoten dan handle edge case `phone` placeholder (FR-3).
7. **Jalankan script** di staging, verifikasi `WhatsAppAccount` baru
   terbentuk untuk tenant yang punya data lama.
8. **Jalankan script** di production (setelah staging verified).

### Fase 4: Hapus sistem lama (breaking)
9. **Hapus** `app/api/admin/settings/whatsapp/route.ts` (FR-4).
10. **Hapus** `modules/settings/services/whatsappSettings.ts` dan export-nya
    dari `modules/settings/index.ts` (FR-4).
11. **Hapus** `modules/notification/services/whatsapp/whatsapp-service.ts`
    dan export-nya dari `modules/notification/index.ts` (FR-4).
12. **Hapus** fallback `Settings` di `WhatsAppService` jika masih ada (tapi
    file ini sudah dihapus di step 11, jadi tidak relevan).
13. **Verifikasi**: `grep` tidak ada referensi sistem lama (AC-4).

### Fase 5: Cleanup data (terpisah, setelah grace period 1 minggu)
14. **Hapus** record `Settings` dengan key WhatsApp lama untuk semua tenant
    (FR-5). Script terpisah, bukan migration.

### Fase 6: Dokumentasi & SOT
15. **Update** `docs/CHANGELOG.md` dengan entry:
    - `[CHANGED]` — Konsolidasi WhatsAppService ke WhatsAppSenderService
    - `[REMOVED]` — Endpoint dan service WhatsApp legacy
16. **Update** `docs/architecture/` jika ada diagram yang menyebut WhatsApp.
17. **Update** `tasks/lessons.md` jika ada pelajaran dari eksekusi.

---

## 7. Risks & Mitigasi

| Risk | Impact | Mitigation |
|------|--------|------------|
| Notifikasi gagal selama transisi | Pelanggan tidak terima invoice/reminder | FR-1 fallback ke `Settings` agar transisi aman sebelum migrasi data |
| Data `Settings` lama tidak termigrasi (phone missing) | Akun tidak bisa dipakai (phone wajib) | Script lapor tenant mana yang perlu edit manual; admin lengkapi setelah migrasi |
| Env var `FONNTE_API_KEY` masih dipakai deployment lama | Notifikasi gagal setelah fallback dihapus | Dokumentasikan di changelog; admin wajib setup akun via UI sebelum upgrade |
| Test Connection bug rekuren | Admin tidak bisa verifikasi akun | Sudah diperbaiki di commit terakhir (decryptApiKey di testConnection); tambah regression test |
| Caller terlewat saat migrasi | Compile error atau runtime error | `grep` verifikasi di Fase 4; typecheck akan tangkap reference yang ketinggalan |

---

## 8. Out of Scope

- Migrasi provider lain (email, push notification) — bukan domain PRD ini.
- Penambahan provider WhatsApp baru (Official API, dll).
- Redesign UI `WhatsappSettingsClient.tsx`.
- Perubahan schema `WhatsAppAccount` atau `Settings`.
- Performance tuning broadcast (sudah ada delay 100ms, dianggap cukup).

---

## 9. Referensi

- Bug fix terkait: `WhatsAppAccountService.testConnection()` decrypt
  (commit sebelumnya).
- Sistem multi-akun: `docs/reports/MULTI_WHATSAPP_IMPLEMENTATION_2026-05-06.md`.
- Arsitektur: `docs/architecture/clean-architecture.md`.
- SOT: `docs/CHANGELOG.md` (entry akan ditambah setelah eksekusi).
- Script migrasi existing: `scripts/migrate-whatsapp-settings.ts`.