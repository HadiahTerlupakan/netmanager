# PRD: WhatsApp Settings — Bug Fix & Code Quality

| Field | Value |
|-------|-------|
| **ID** | PRD-WHATSAPP-BUGFIX-2026-07-11 |
| **Tanggal** | 2026-07-11 |
| **Author** | agent |
| **Status** | Draft — Menunggu eksekusi |
| **Scope** | `app/api/admin/whatsapp/stats/route.ts`, `modules/notification/services/whatsapp-account.service.ts`, `modules/notification/services/whatsapp/providers/mpwa-provider.ts`, `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx` |
| **Related PRD** | `PRD-CONSOLIDATE-WHATSAPP-2026-07-11.md` (konsolidasi sistem lama → baru) |

---

## 1. Latar Belakang

Hasil audit mendalam terhadap modul `admin/pengaturan/whatsapp` dan seluruh
relasi downstream-nya menemukan **4 bug/issue** yang belum tercakup di
`PRD-CONSOLIDATE-WHATSAPP-2026-07-11.md`. Issue ini independen dari proses
konsolidasi dan dapat diperbaiki lebih awal tanpa menunggu konsolidasi selesai.

---

## 2. Daftar Bug & Issue

### BUG-01 — `stats` route tidak validasi kepemilikan `accountId` (IDOR)

**Lokasi**: [`app/api/admin/whatsapp/stats/route.ts`](app/api/admin/whatsapp/stats/route.ts)

**Deskripsi**:
Endpoint `GET /api/admin/whatsapp/stats?accountId=<id>` menerima `accountId`
dari query param dan langsung query `WhatsAppMessage` tanpa verifikasi bahwa
`accountId` tersebut milik `session.tenantId`. Akibatnya, admin dari tenant A
yang mengetahui CUID akun WhatsApp tenant B bisa membaca statistik pesan
(total, sent, failed, pending) tenant lain.

**Root cause**:
```ts
// route saat ini — tidak ada validasi kepemilikan:
const stats = await service.getAccountStats(
  accountId,                          // ← langsung dipakai tanpa cek tenantId
  startDate ? new Date(startDate) : undefined,
  endDate ? new Date(endDate) : undefined,
);
```

`WhatsAppAccountService.findById(id, tenantId)` sudah ada dan sudah punya
guard `findTenantAccount()` — tinggal dipanggil sebelum `getAccountStats`.

**Severity**: Medium
**Dampak**: Kebocoran statistik pesan lintas tenant (bukan payload isi pesan,
hanya angka count).

---

### BUG-02 — `testConnection` tidak catat `WhatsAppMessage` record & tidak increment `dailyCount`

**Lokasi**: [`modules/notification/services/whatsapp-account.service.ts`](modules/notification/services/whatsapp-account.service.ts) — method `testConnection()`

**Deskripsi**:
`testConnection()` mengirim pesan WhatsApp nyata ke provider eksternal, tapi
tidak membuat record `WhatsAppMessage` dan tidak memanggil
`accountRepo.incrementDailyCount()`. Ini inkonsisten dengan `sendViaAccount()`
di `WhatsAppSenderService` yang selalu:
1. Buat record `WhatsAppMessage` status `pending`
2. Update status ke `sent`/`failed`
3. Increment `dailyCount` jika berhasil

Akibatnya:
- History pesan di `/api/admin/whatsapp/messages` tidak mencatat test connection
- `dailyCount` tidak bertambah → bisa bypass `dailyLimit` via test berkali-kali
- Admin tidak bisa lihat apakah test pernah dilakukan dan hasilnya apa

**Root cause**:
`testConnection()` di `whatsapp-account.service.ts` langsung panggil
`provider.sendMessage()` tanpa inject `WhatsAppMessageRepository`.

**Severity**: Low–Medium
**Dampak**: Inkonsistensi data history, potensi bypass dailyLimit.

---

### BUG-03 — `MpwaProvider.isSuccessResponse` dead code

**Lokasi**: [`modules/notification/services/whatsapp/providers/mpwa-provider.ts`](modules/notification/services/whatsapp/providers/mpwa-provider.ts) — baris 144–152

**Deskripsi**:
Method `private isSuccessResponse()` didefinisikan di `MpwaProvider` tapi
tidak pernah dipanggil. Yang aktif dipakai adalah `isSuccessGatewayResponse()`
dari `whatsapp-gateway-utils.ts` (baris 87). Kedua method memiliki logika
hampir identik tapi terpisah — dead code yang membingungkan.

```ts
// Dead — tidak pernah dipanggil di mana pun:
private isSuccessResponse(result: Record<string, unknown>) {
  return (
    result.status === true ||
    result.success === true ||
    result.status === "success" ||
    result.status === "sent" ||
    result.message === "success"
  );
}
```

**Severity**: Low (code smell)
**Dampak**: Kebingungan developer, potensi divergensi logika success check.

---

### BUG-04 — Frontend `Array.isArray` dead branch

**Lokasi**: [`app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`](app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx) — baris 68–70

**Deskripsi**:
Frontend handle dua format response:
```ts
const accounts: WhatsAppAccount[] = Array.isArray(rawAccounts)
  ? rawAccounts                   // ← tidak pernah tercapai
  : (rawAccounts?.data ?? []);    // ← selalu ini
```
API `GET /api/admin/whatsapp/accounts` selalu return `{ success: true, data: WhatsAppAccount[] }`.
Branch `Array.isArray` tidak pernah true. Dead code yang misleading.

**Severity**: Low (dead code)
**Dampak**: Tidak ada runtime impact, tapi misleading bagi developer.

---

## 3. Non-Goals

- Tidak mengubah schema Prisma (tidak perlu migration).
- Tidak mengubah UI/UX halaman WhatsApp settings.
- Tidak menyentuh provider Fonnte, Wablas (tidak ada issue di sana).
- Tidak overlap dengan `PRD-CONSOLIDATE-WHATSAPP-2026-07-11.md`.

---

## 4. Requirements

### FR-1: Tambah validasi kepemilikan `accountId` di stats route (BUG-01)

**File**: `app/api/admin/whatsapp/stats/route.ts`

Sebelum `getAccountStats()`, panggil `WhatsAppAccountService.findById(accountId, session.tenantId)`.
Jika tidak ditemukan (null) → return 404.

```ts
// Setelah:
const accountService = new WhatsAppAccountService();
const account = await accountService.findById(accountId, session.tenantId);
if (!account) {
  return NextResponse.json(
    { success: false, error: "Akun tidak ditemukan" },
    { status: 404 },
  );
}
```

**Acceptance Criteria**:
- Admin tenant A request stats dengan `accountId` milik tenant B → 404
- Admin tenant A request stats dengan `accountId` milik tenant A → 200 + data stats
- SUPER_ADMIN request stats akun mana pun → 200 (karena bypass `findById` via `isSuperAdmin`)

---

### FR-2: `testConnection` catat `WhatsAppMessage` & increment `dailyCount` (BUG-02)

**File**: `modules/notification/services/whatsapp-account.service.ts`

Inject `WhatsAppMessageRepository` ke `WhatsAppAccountService` (opsional di
constructor untuk testability). Di `testConnection()`, setelah berhasil/gagal
kirim:
1. Buat record `WhatsAppMessage` dengan status `sent`/`failed`
2. Jika `sent` → increment `dailyCount`

**Catatan**: `dailyCount` hanya di-increment jika test berhasil, konsisten
dengan `sendViaAccount()`.

**Acceptance Criteria**:
- Setelah test connection berhasil → ada 1 record baru di `WhatsAppMessage` status `sent`
- Setelah test connection gagal → ada 1 record baru di `WhatsAppMessage` status `failed`
- `dailyCount` akun bertambah 1 setelah test berhasil
- `dailyCount` tidak berubah jika test gagal

---

### FR-3: Hapus `MpwaProvider.isSuccessResponse` dead code (BUG-03)

**File**: `modules/notification/services/whatsapp/providers/mpwa-provider.ts`

Hapus method `private isSuccessResponse()` baris 144–152. Pastikan tidak ada
referensi ke method ini sebelum dihapus.

**Acceptance Criteria**:
- `grep -n "isSuccessResponse" mpwa-provider.ts` → tidak ada hasil
- `npm run typecheck` lulus tanpa error baru

---

### FR-4: Hapus `Array.isArray` dead branch di frontend (BUG-04)

**File**: `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`

Sederhanakan ke:
```ts
const accounts: WhatsAppAccount[] = (rawAccounts as { data?: WhatsAppAccount[] })?.data ?? [];
```

Atau jika `useApi` sudah typed:
```ts
const accounts: WhatsAppAccount[] = rawAccounts?.data ?? [];
```

**Acceptance Criteria**:
- Halaman `/admin/pengaturan/whatsapp` tetap render daftar akun dengan benar
- Tidak ada TypeScript error baru
- Branch `Array.isArray` tidak ada lagi di file

---

## 5. Implementation Plan

Urutan eksekusi disarankan dari yang paling kecil risikonya:

| Fase | Task | File | Risiko |
|------|------|------|--------|
| 1 | Hapus dead code `MpwaProvider.isSuccessResponse` | `mpwa-provider.ts` | Sangat rendah |
| 2 | Sederhanakan `Array.isArray` dead branch | `WhatsappSettingsClient.tsx` | Sangat rendah |
| 3 | Tambah validasi `accountId` di stats route | `stats/route.ts` | Rendah |
| 4 | `testConnection` catat message record | `whatsapp-account.service.ts` | Rendah–Medium |

Fase 1 dan 2 bisa dilakukan dalam satu commit. Fase 3 dan 4 masing-masing
commit terpisah untuk isolasi review.

---

## 6. Testing Requirements

| Bug | Test yang Harus Ditambah |
|-----|--------------------------|
| BUG-01 | Unit test: `stats` route return 404 jika `accountId` bukan milik tenant |
| BUG-01 | Unit test: `stats` route return 200 jika `accountId` milik tenant |
| BUG-02 | Unit test: `testConnection` sukses → `WhatsAppMessage` status `sent` terbuat |
| BUG-02 | Unit test: `testConnection` gagal → `WhatsAppMessage` status `failed` terbuat |
| BUG-02 | Unit test: `dailyCount` increment setelah test sukses |
| BUG-03 | Tidak perlu test tambahan — pure deletion |
| BUG-04 | Tidak perlu test tambahan — UI smoke test cukup |

File test yang relevan:
- `tests/modules/notification/WhatsAppAccountService.test.ts` — extend untuk BUG-02
- Buat baru `tests/api/admin/whatsapp/stats.test.ts` — untuk BUG-01

---

## 7. Risks & Mitigasi

| Risk | Mitigasi |
|------|----------|
| BUG-02: `WhatsAppAccountService` jadi punya dependency ke `WhatsAppMessageRepository` — circular? | Tidak circular — `MessageRepo` tidak depend ke `AccountService`. Inject via constructor optional. |
| BUG-01: SUPER_ADMIN bypass `isTenantAccount` → stats akun dari tenant mana pun bisa diakses | Intentional — SUPER_ADMIN memang punya akses semua tenant. Tidak perlu dibatasi. |
| BUG-04: `rawAccounts` typing berubah | Cek type `useApi<>` generic — update type parameter jika perlu untuk strict typing. |

---

## 8. Acceptance Criteria Global

- [ ] `npm run check` (lint + typecheck + build) lulus tanpa error baru
- [ ] `npm run test:run` lulus, tidak ada test yang sebelumnya pass menjadi fail
- [ ] `grep -n "isSuccessResponse" modules/notification/services/whatsapp/providers/mpwa-provider.ts` → tidak ada hasil
- [ ] `grep -n "Array.isArray" app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx` → tidak ada hasil
- [ ] Request `GET /api/admin/whatsapp/stats?accountId=<cross-tenant-id>` → 404
- [ ] Test connection pada akun aktif → record `WhatsAppMessage` terbuat di DB

---

## 9. Referensi

- Audit source: sesi analisis deep `admin/pengaturan/whatsapp` — 2026-07-11
- PRD konsolidasi terkait: `docs/specifications/PRD-CONSOLIDATE-WHATSAPP-2026-07-11.md`
- Service utama: `modules/notification/services/whatsapp-account.service.ts`
- Stats route: `app/api/admin/whatsapp/stats/route.ts`
- Provider MPWA: `modules/notification/services/whatsapp/providers/mpwa-provider.ts`
- Frontend: `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
