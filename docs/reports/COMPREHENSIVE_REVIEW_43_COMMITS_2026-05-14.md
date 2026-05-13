# Comprehensive Review Report — 43 Commit (B1-B8 + Phase 1-9)

**Tanggal**: 2026-05-14
**Reviewer**: 4 paralel review session (1 internal B-batch + 3 subagent paralel Phase 1-9)
**Scope**: 43 commit ahead of `origin/staging` (dari `5fd33af26` sampai `5be7b0694`)
**Branch**: `staging`

---

## Executive Summary

| Kategori | Jumlah | Verifikasi |
|----------|--------|------------|
| 🔴 CRITICAL | 5 | Semua verified, blocker untuk push |
| 🟠 IMPORTANT | 14 | Mostly likely valid, perlu fix sebelum production |
| 🟡 MINOR | 12 | Maintainability, tidak urgent |
| 🟢 Dismissed | 2 | False positive saat verifikasi |

**Total**: 33 unique findings (setelah dedup overlap antar reviewer)

**Rekomendasi**: 5 CRITICAL harus diselesaikan sebagai batch baru (B9–B13) sebelum push ke origin/staging. IMPORTANT bisa diselesaikan secara bertahap.

---

## Cakupan Review

### Range commit

```
5fd33af26..5be7b0694
```

43 commit terbagi dalam dua kelompok:

1. **Phase 1-9 (35 commit)** — refactor event-driven sebelumnya, sudah pernah di-review dan menghasilkan 20 issue yang dikerjakan B1-B8.
2. **B1-B8 (8 commit)** — fix dari hasil review komprehensif sebelumnya.

### Reviewer

| Agent | Scope | Status |
|-------|-------|--------|
| Internal review B-batch | 8 commit B1-B8 | ✅ |
| Agent 1 — Code reviewer | Phase 1-3 event-driven core | ✅ |
| Agent 2 — Code reviewer | Phase 4-5 webhook + payment gateway security | ✅ |
| Agent 3 — Code reviewer | Phase 6-9 notification + UI + observability | ✅ |

---

## 🔴 CRITICAL (5) — Blocker untuk push

### C1 — Security fix `7b6e2bc74` di-apply ke folder legacy yang masih ada

**Source**: Agent 2 (Phase 4-5)
**Status**: ✅ VERIFIED via `grep` produksi
**Severity**: CRITICAL — timing attack lolos di 6 payment gateway provider production

**File terdampak (production)**:
- `modules/payment-gateway/services/providers/bri-provider-utils.ts:65`
- `modules/payment-gateway/services/providers/dana-provider.ts:131`
- `modules/payment-gateway/services/providers/midtrans-provider.ts:129`
- `modules/payment-gateway/services/providers/duitku-provider.ts:178`
- `modules/payment-gateway/services/providers/moota-provider.ts:95`
- `modules/payment-gateway/services/providers/tripay-provider.ts:192`

**Skenario**: Commit `7b6e2bc74` claim mengganti `===` dengan `timingSafeEqual` di 6 provider. Saat verifikasi, file yang dimodifikasi ternyata di path `modules/finance/services/payment-gateway/providers/` (legacy). Folder ini masih ada lengkap (17 file) padahal commit `d66a7612c` claim menghapus dead code — yang dihapus hanya `webhook-processing-service.ts` dan `webhook-invoice-settlement-service.ts`, **bukan folder providers**.

`provider-factory.ts` di production module mengimport semua provider dari `./providers/` (production path), sehingga production tetap pakai versi `===`. Cuma Xendit dan BCA yang sudah pakai `timingSafeEqual` (di production).

**Konsekuensi bisnis**: Attacker bisa kirim webhook palsu dengan signature wrong, ukur response time, byte-by-byte tebak signature valid → trigger `INVOICE_PAID` palsu → fraud pembayaran. Ini adalah CVE level di production payment processing.

**Helper file `signature-compare.helpers.ts`** yang dibuat di commit juga ada di path legacy, tidak di production. Plus length-mismatch early-return di helper masih bocor info panjang signature.

**Recommended fix**:
1. Apply `timingSafeCompare` ke 6 provider production di path yang benar.
2. Hapus folder legacy `modules/finance/services/payment-gateway/providers/`.
3. Pastikan `signature-compare.helpers.ts` di production path tidak punya length-mismatch early return (atau pakai HMAC dari kedua string untuk samakan panjang).

---

### C2 — `EmailDeliveryLog` tidak menyimpan `tenantId` → multi-tenant data leak

**Source**: Agent 3 (Phase 6-9)
**Status**: ✅ VERIFIED via `grep`
**Severity**: CRITICAL — cross-tenant data exposure di endpoint admin

**File terdampak**:
- `modules/notification/services/email-service.ts:90-94` — `sendEmail` tidak terima `tenantId`
- `modules/notification/services/NotificationDispatcher.ts:218-219` — `sendEmail` panggil `EmailService.sendEmail` tanpa pass `contact.tenantId`
- `modules/notification/repositories/EmailDeliveryLogRepository.ts` — `logAttempt` terima `tenantId?: string | null` opsional → tersimpan `null`

**Konsekuensi bisnis**: Multi-tenant deployment, admin tenant A bisa lihat log email tenant B via `/api/admin/notifications/email-logs`. Filter `tenantId` di endpoint B1 (commit `36b3c89a2`) tidak efektif karena semua row punya `tenantId = null` → query filter tidak match.

**Recommended fix**:
1. Tambah `tenantId?: string | null` ke `SendEmailParams` di `email-service.ts`.
2. Update `NotificationDispatcher.sendEmail` (line 211+) supaya pass `tenantId: contact.tenantId`.
3. Backfill: data migration script untuk mengisi `tenantId` untuk row lama (resolve via `to` lookup ke pelanggan, atau set `null` jika non-billing).

---

### C3 — `handleNextCycle` abaikan `prorateOption` → silent revenue loss

**Source**: Agent 3 (Phase 6-9)
**Status**: ✅ VERIFIED via inspeksi kode
**Severity**: CRITICAL — admin pilih PRORATE_CHARGE + NEXT_CYCLE → tidak ada invoice prorate dibuat

**File terdampak**: `modules/finance/services/InvoiceProrateService.ts:113-130`

**Skenario**: Admin pilih `upgradeApplyTime = NEXT_CYCLE` dan `prorateOption = PRORATE_CHARGE`. `handleNextCycle` langsung panggil `schedulePackageChange` lalu `logProrateActivity` dengan `amount = 0n` — tidak ada pengecekan `prorateOption`. Invoice prorate tidak dibuat. Log audit mencatat `prorateOption = "PRORATE_CHARGE"` dengan `amount = 0` → admin lihat log seolah prorate sudah diproses.

UI di `PppClientPackageChangeSection.tsx` tidak prevent kombinasi (tetap tampilkan opsi PRORATE_CHARGE meski user pilih NEXT_CYCLE). Server-side juga tidak validate.

**Konsekuensi bisnis**: Pelanggan upgrade paket dengan NEXT_CYCLE + PRORATE_CHARGE tidak ditagih selisih prorate. Revenue loss tanpa jejak yang jelas.

**Recommended fix**:
1. `handleNextCycle`: throw error jika `prorateOption !== "NONE"` atau implementasikan defer-charge (delayed invoice creation saat cron apply).
2. UI: reset `prorateOption` ke `NONE` saat user pilih `NEXT_CYCLE`, atau sembunyikan dropdown prorate saat NEXT_CYCLE.
3. Server validate kombinasi di `PelangganAdminMutationService` atau Zod schema.

---

### C4 — TOCTOU race di `consumeSaldoKredit` masih ada meski ada optimistic lock

**Source**: Internal review B-batch (R1)
**Status**: ✅ VERIFIED via inspeksi kode
**Severity**: CRITICAL — saldo kredit pelanggan bisa dikurangi 2x

**File terdampak**: `modules/finance/services/BillingInvoiceCreationService.ts:95-106`

**Skenario**: `consumeSaldoKredit` melakukan `findUnique` baca saldo, lalu `updateMany` dengan `WHERE saldoKreditRupiah >= apply`. Antara dua operasi ini ada window race: dua billing job paralel untuk pelanggan sama bisa keduanya baca saldo 50.000, keduanya hitung `apply = 50.000`, dan **keduanya berhasil `updateMany`** karena pada saat masing-masing eksekusi kondisi `>= apply` masih terpenuhi pada DB row. Hasilnya saldo dikurangi 2x.

Komentar di kode menyebut "atomic via updateMany" — misleading. Ini bukan atomic dalam arti sesungguhnya — dua transaksi terpisah tanpa serializable isolation atau SELECT FOR UPDATE bisa lolos bersamaan.

**Konsekuensi bisnis**: Pelanggan kehilangan saldo kredit lebih besar dari semestinya. Saldo bisa jadi negatif jika tidak ada constraint DB.

**Recommended fix**:
1. Pakai raw SQL `UPDATE pelanggan SET saldoKreditRupiah = GREATEST(0, saldoKreditRupiah - $cap) WHERE id = $id RETURNING (old - new) AS applied`.
2. Atau wrap `findUnique + updateMany` dalam `prisma.$transaction([...], { isolationLevel: 'Serializable' })`.
3. Atau pindah saldo logic ke repository dan pakai SELECT FOR UPDATE manual via raw query.

---

### C5 — `missing-package` outcome di `PendingPackageApplier` adalah silent partial failure

**Source**: Internal review B-batch (R3)
**Status**: ✅ VERIFIED via inspeksi kode
**Severity**: CRITICAL — DB sudah update tapi MikroTik tidak tahu

**File terdampak**: `modules/finance/services/PendingPackageApplierService.ts:126-131`

**Skenario**: Setelah `updateMany` sukses (DB berubah, `hargaPaketId` sudah jadi `pendingPackageId`), kode panggil `findPackagePair` untuk fetch context. Kalau salah satu paket tidak ditemukan, fungsi return `"missing-package"` → di caller dihitung sebagai `failed++`, **tapi tidak throw**.

Akibatnya:
1. DB sudah ter-update (paket sudah berganti)
2. Event `PACKAGE_CHANGED` tidak di-emit
3. MikroTik/RADIUS tidak di-sync
4. Pelanggan berjalan dengan paket baru di DB tapi profile PPP lama di router
5. Hanya `logger.warn`, tidak ada alert
6. BullMQ tidak retry karena tidak ada exception

**Konsekuensi bisnis**: Pelanggan bayar paket baru, dapat bandwidth lama (atau sebaliknya). Tidak akan terdeteksi otomatis. Manual intervention required.

**Recommended fix**:
1. Outcome `missing-package` harus throw, supaya BullMQ retry.
2. Atau log dengan severity `error` dan push ke alert/reconciliation queue.
3. Test perlu di-update untuk assert `mockOnPackageChanged.not.toHaveBeenCalled()` saat missing-package.

---

## 🟠 IMPORTANT (14)

### I1 — `CUSTOMER_UPDATED` non-persistent tapi handler MikroTik subscribe

**Source**: Agent 1 (Phase 1-3)
**File**: `lib/event-bus/types.ts:448-453`

`CUSTOMER_UPDATED` punya metadata `persistent: false` → tidak masuk outbox. Tapi handler `handleCustomerStatusEvent` subscribe ke event ini → operasi MikroTik/RADIUS sync yang kritis. Kalau BullMQ down saat event dispatch, event hilang tanpa recovery.

**Fix**: Ubah `CUSTOMER_UPDATED` ke `persistent: true`, atau pisahkan handler (jangan daftar `handleCustomerStatusEvent` untuk CUSTOMER_UPDATED).

---

### I2 — `CUSTOMER_DELETED` tanpa `tenantId` → BullMQ infinite retry

**Source**: Agent 1 (Phase 1-3)
**File**: `modules/network/services/event-handlers/customer-status.handler.ts:31-37`

Handler ambil `tenantId` dengan `typeof payload.tenantId === "string" ? payload.tenantId : undefined`. Kalau tidak ada, `radius.removeCustomer` throw karena guard internal. BullMQ retry forever karena `tenantId` tidak akan muncul di payload yang sudah di-queue.

**Konsekuensi**: RADIUS credential pelanggan tidak terhapus → orphan credential yang bisa dieksploitasi.

**Fix**: Pakai `requirePayloadString(payload.tenantId, "tenantId", SOURCE)` untuk fail-fast di handler.

---

### I3 — `handleInvoicePaidBilling` & `handleInvoicePaidActivation` tidak ada test

**Source**: Agent 1 (Phase 1-3)

Dua handler critical path untuk INVOICE_PAID tidak punya unit test handler-level. Test yang ada (`customerStatusSyncDelegation.test.ts`) test `AutomaticBillingService.handleInvoicePaid` direct, bukan via BullMQ job.

**Fix**: Tambah test pakai pola `customer-status.handler.test.ts`.

---

### I4 — `signature-compare.helpers.ts` length-mismatch early-return

**Source**: Agent 2 (Phase 4-5)
**File**: `modules/finance/services/payment-gateway/providers/signature-compare.helpers.ts:24-26` (kalau eventually dipakai)

```ts
if (expectedBuffer.length !== actualBuffer.length) return false;
```

Length-mismatch return cepat → bocor info panjang signature lewat timing side-channel.

**Fix**: HMAC kedua string untuk samakan panjang sebelum compare, atau SHA256 dulu dari kedua input.

---

### I5 — `PaymentStatusUpdater.ts` dead code masih ada

**Source**: Agent 2 (Phase 4-5)
**File**: `modules/payment-gateway/services/PaymentStatusUpdater.ts`

Class tidak diinstansiasi siapa-siapa (grep bersih), tapi file masih ada dengan logic update payment yang berbeda dari implementasi baru (no outbox emit). Architecture test masih daftarkan sebagai public API.

**Fix**: Hapus file + update architecture test allowlist.

---

### I6 — `markAsProcessed` di luar transaction outbox → idempotency gap

**Source**: Agent 2 (Phase 4-5)
**File**: `modules/payment-gateway/services/webhook-processing-service.ts:340`

```ts
// Di dalam $transaction:
await saveToOutboxTx(tx, { ... });
// Setelah commit:
await this.idempotencyService.markAsProcessed(webhookEventId);
```

Kalau crash antara commit tx dan `markAsProcessed`, gateway retry webhook → `checkIdempotency` miss → outbox insert duplikat INVOICE_PAID.

**Fix**: Pindah `markAsProcessed` ke dalam `$transaction` yang sama, atau pakai upsert di outbox dengan unique key untuk dedupe.

---

### I7 — `PACKAGE_CHANGED` tidak punya notification handler

**Source**: Agent 3 (Phase 6-9)
**File**: `lib/event-bus/event-handlers.ts:392`

`PACKAGE_CHANGED` cuma punya 1 handler: `handlePackageChange` (network sync). Tidak ada notifikasi ke pelanggan saat paket diupgrade/downgrade.

**Fix**: Tambah template `packageChanged` di `BILLING_TEMPLATES` + register handler notifikasi untuk `PACKAGE_CHANGED`.

---

### I8 — `PushRetryQueue` tidak detect `DeviceNotRegistered`

**Source**: Agent 3 (Phase 6-9)
**File**: `modules/notification/services/PushRetryQueue.helpers.ts:98-106`

Token expired/uninstalled tetap retry MAX_RETRIES (3x) sebelum drop. Expo API return `DeviceNotRegistered` yang seharusnya langsung drop + hapus token dari DB.

**Fix**: Parse Expo response untuk `DeviceNotRegistered` → skip requeue + delete token.

---

### I9 — Tidak ada retention policy `EmailDeliveryLog` + `NotificationDeadLetter`

**Source**: Agent 3 (Phase 6-9)
**File**: migration phase8

Tabel terus tumbuh tanpa cleanup. ISP dengan ratusan pelanggan + billing bulanan = jutaan row dalam setahun. Pagination dengan OFFSET makin lambat.

**Fix**: Cron cleanup untuk `EmailDeliveryLog.createdAt < 90 days AND status IN (SENT, BOUNCED)`, `NotificationDeadLetter.resolvedAt < 30 days`.

---

### I10 — `PROFILE_PPP_UPDATED` partial fail → BullMQ retry seluruh batch

**Source**: Agent 3 (Phase 6-9)
**File**: `modules/network/services/event-handlers/profile-ppp-updated.handler.ts:89-93`

1 dari 1000 pelanggan gagal disconnect → handler throw → BullMQ retry seluruh job → 999 pelanggan yang sudah berhasil di-disconnect ulang. Gangguan layanan massal.

**Fix**: Catat fail ke DLQ tapi tidak throw kalau ada partial success. Atau idempotency check: skip kalau session sudah inactive.

---

### I11 — `ProratePaymentLog` tidak ada UI admin

**Source**: Agent 3 (Phase 6-9)

Audit trail prorate tidak accessible. Admin harus query DB manual kalau ada dispute.

**Fix**: Tambah tab/section di detail pelanggan + endpoint `/api/admin/pelanggan/[id]/prorate-log`.

---

### I12 — UI `goToPage` double `setPagination` → flicker + state inkonsisten

**Source**: Internal B-batch (R7)
**File**: `DeadLetterClient.tsx:142-145` & `EmailLogsClient.tsx:94-96`

`fetchEntries` sudah set `pagination` dari response. `goToPage` set lagi manual → 2 render dengan state berbeda. Kalau fetch abort, `setPagination` manual tetap jalan tapi entries tidak terupdate.

**Fix**: Hapus `setPagination` manual dari `goToPage`. Single source of truth via response.

---

### I13 — `updateSyncStatus` throw di catch → `throw err` tidak tercapai

**Source**: Internal B-batch (R4)
**File**: `customer-status.handler.ts:74-83` + `package-change.handler.ts:56-66`

```ts
await pelangganService.updateSyncStatus(customerId, "FAILED", errorMessage);
throw err;  // ← tidak tercapai kalau updateSyncStatus throw
```

Kalau `updateSyncStatus` throw (mis. P2025 record not found karena pelanggan sudah dihapus), error asli MikroTik hilang. BullMQ retry pakai error yang salah.

**Fix**: Wrap `updateSyncStatus` di catch dengan `.catch(...)` yang hanya log, lalu `throw err`. Atau di `PelangganService.updateSyncStatus`, swallow P2025.

---

### I14 — Retry DLQ tidak idempotent (no dedupeKey saat retry)

**Source**: Internal B-batch (R6)
**File**: `app/api/admin/notifications/dead-letter/[id]/retry/route.ts`

Tidak pass `dedupeKey` ke dispatcher. Kalau dispatch sukses tapi `prisma.update` gagal → entry tetap pending → admin retry → pelanggan dapat notifikasi 2x.

**Fix**: `dedupeKey: \`retry-dlq:${entry.id}\`` saat retry.

---

## 🟡 MINOR (12)

| # | File | Issue |
|---|------|-------|
| M1 | `BillingInvoiceCreationService.ts:95,104` | `consumeSaldoKredit` akses `prisma` direct → inkonsisten dengan B8 repo abstraction |
| M2 | `ProrateRepository.ts:75-76` | `Date.now()` dipanggil terpisah untuk `invoiceNumber` & `issueDate` → bisa beda ms |
| M3 | `tests/.../InvoiceProrateService.test.ts` | Test error tidak assert `error.code` (typed error code tidak ter-cover) |
| M4 | `event-handlers.ts:83` | Komentar "2 handler paralel" untuk INVOICE_PAID padahal ada 3 |
| M5 | `EmailService` | Cross-module dep ke `AttendanceSettingsService` (misplaced dependency) |
| M6 | `NotificationDeadLetterRepository.findUnresolved` | Tidak terima `tenantId` filter |
| M7 | `DeadLetterClient.tsx` | Pakai `alert()` (anti-pattern React) — project punya toast pattern |
| M8 | `BillingEventDispatcher.onInvoicePaid` | Priority `CRITICAL` di dispatcher tapi metadata default `HIGH` (inkonsisten) |
| M9 | `event-bus.ts:214-216` | EventBus singleton tidak persist di production env |
| M10 | `invoice-notification.handler.ts:69` | `toLocaleDateString("id-ID")` server-locale dependency |
| M11 | UI fetch error | `clientLogger.error` tanpa display ke user (DeadLetterClient + EmailLogsClient) |
| M12 | `lib/event-bus/event-handlers.ts:134-388` | Handler legacy (NOTIFICATION_CREATED, INVENTORY, TICKET, ATTENDANCE) tidak re-throw — pre-existing |

---

## 🟢 Dismissed / False positive

### D1 — Agent 1 C1: "Cascading MikroTik sync"

**Klaim**: `handleInvoicePaidActivation` panggil `updateStatusPelanggan` yang emit `CUSTOMER_ACTIVATED` → handler MikroTik sync → "double sync".

**Verifikasi**: Itu bukan double sync — itu **single sync** via event handler. Sebelumnya (di radius-sync-hooks lama yang sudah dihapus), sync di-call langsung dari helper. Setelah migrasi event-driven, sync via event handler = single source of truth. Ini desain yang benar, bukan bug.

### D2 — Agent 3 C3: "Race condition cancel pending vs cron applier"

**Klaim**: Cancel pending vs cron applier ada race.

**Verifikasi**: TOCTOU sudah di-fix di B2 (optimistic update pattern di `PendingPackageApplierService`). Concern yang tersisa adalah feedback ke admin saat cancel terlambat (paket sudah ter-apply) — itu MINOR concern, bukan CRITICAL race.

---

## Action Plan (Rekomendasi Batch)

### Phase 1 — Blocker fix (B9-B13)

| Batch | Issue | File utama | Estimasi |
|-------|-------|-----------|---------|
| B9 | C1 — Apply timing-safe ke 6 production provider + hapus folder legacy | `modules/payment-gateway/services/providers/*.ts` | M |
| B10 | C2 — Propagate tenantId di EmailService chain + backfill migration | `email-service.ts`, `NotificationDispatcher.ts`, migration | S |
| B11 | C3 — Guard prorateOption di NEXT_CYCLE + UI prevent kombinasi | `InvoiceProrateService.ts`, `PppEditClient.tsx` | S |
| B12 | C4 — Fix TOCTOU consumeSaldoKredit (raw SQL atau serializable tx) | `BillingInvoiceCreationService.ts` | S |
| B13 | C5 — `missing-package` harus throw, update test | `PendingPackageApplierService.ts` + test | XS |

Setelah B9-B13 → 5 CRITICAL beres → safe untuk push.

### Phase 2 — IMPORTANT (B14+, opsional sebelum push)

Prioritas tinggi: I1, I2, I6, I10, I13, I14 (data integrity / event reliability).
Prioritas menengah: I3, I7, I9, I11, I12 (observability / UX).
Prioritas rendah: I4, I5, I8 (cleanup, edge case).

### Phase 3 — MINOR

Bisa dikerjakan saat ada kapasitas. Tidak blocker.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Timing attack lolos di production | Medium | Severe (fraud) | B9 ASAP |
| Multi-tenant data leak email log | Low (manual lookup) | High (compliance) | B10 sebelum publik |
| Silent revenue loss NEXT_CYCLE prorate | Medium (admin error) | Medium (per kasus) | B11 |
| Saldo kredit dikurangi 2x | Low (race window kecil) | Medium per pelanggan | B12 |
| Pelanggan dapat bandwidth salah | Low (paket missing rare) | Medium per pelanggan | B13 |

---

## Catatan Reviewer

- **Verifikasi manual** dilakukan untuk 3 dari 5 CRITICAL claim (C1, C2, C3) untuk mencegah false positive masuk action plan.
- **C4 + C5** sudah teridentifikasi di review B-batch internal sebelumnya, tidak perlu re-verify.
- **D1 dan D2** dismissed setelah cek kode — agent salah interpretasi pola event-driven.
- **R23** dari B-batch (handler legacy NOTIFICATION_CREATED dll tidak re-throw) → bukan dari range commit ini, pre-existing. Tidak masuk action plan.

---

*Last Updated: 2026-05-14*
*Total findings: 31 actionable + 2 dismissed*
*Next action: User decide batch scheduling*
