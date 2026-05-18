# Deep Review — Mobile App ↔ Backend Integration

**Tanggal:** 2026-05-18
**Reviewer:** agent (4 paralel subagent + sintesis)
**Scope:** mobile-netmanager (Expo / React Native) ↔ netmanager (Next.js 14)
**Metode:** static code analysis end-to-end pada 4 area utama, baca implementasi aktual (bukan asumsi)

**Total temuan:** 78 issue
- **Critical:** 11
- **High:** 27
- **Medium:** 30
- **Low:** 10

**Appendix (raw report per area):**
- [01 — Auth & Token Flow](./mobile-deep-review-2026-05-18/01-auth-token-flow.md) (17 issue)
- [02 — Offline Sync & Idempotency](./mobile-deep-review-2026-05-18/02-offline-sync-idempotency.md) (12 issue)
- [03 — Real-time & FCM](./mobile-deep-review-2026-05-18/03-realtime-fcm.md) (23 issue)
- [04 — Cross-cutting Concerns](./mobile-deep-review-2026-05-18/04-cross-cutting.md) (24 issue + 2 ringkasan)

---

## Executive Summary

Integrasi mobile ↔ backend punya pondasi solid (single-flight refresh, secure storage native, RBAC tenant, idempotency attendance, pLimit concurrent sync). Namun ada **gap serius di area yang invisible kecuali dilihat end-to-end**:

1. **Idempotency hanya implementasi separuh** — attendance dilindungi sempurna (Redis SETNX, payload hash, replay cache), tapi work-order, inventory, leave, FCM endpoint **abaikan** `Idempotency-Key` header. SyncService replay → duplicate work order, duplicate stock movement, duplicate leave request. Untuk inventory/payroll ini berdampak finansial.

2. **Cross-tenant FCM leak** — `getAdminTokens()` query tanpa filter `tenantId`. Notifikasi tenant A dipush ke admin tenant B. Multi-tenant data leak terkonfirmasi di `lib/firebase/messaging.ts:9-29`.

3. **Custom token Firestore tidak pernah refresh** — listener mati senyap setelah ~1 jam. User lihat data "frozen" tanpa error message. Kombinasi dengan FCM token tidak di-deleteToken saat logout = cross-account event leakage di shared device.

4. **Password plaintext di SecureStore** untuk biometric login. Biometric jadi gerbang ke brankas password, bukan sumber autentikasi. Pada device rooted/iCloud Keychain backup → password bocor.

5. **Logout TIDAK revoke server-side** untuk Employee/Mitra. Refresh token tetap valid 30 hari setelah logout. Customer lebih baik (tokenVersion rotation), tapi `signMobileToken` hanya **read** tokenVersion, tidak increment.

6. **Geofence bypass via null coordinates** — matikan GPS → status `UNKNOWN` → backend skip validation walau policy STRICT. Karyawan check-in dari mana saja.

7. **DatabaseService bukan SQLite, hanya AsyncStorage JSON rewrite** — tidak ada schema versioning, tidak ada row-level atomicity. Bila `SyncQueueItem` interface berubah, parse fail → fallback empty queue → **data offline user hilang silently**. `clearSessionData` saat logout juga wipe queue → data integrity loss saat token expired.

8. **Disk leak photo offline** — `cleanupOfflinePhoto` di-export tapi **tidak pernah dipanggil**. File offline menumpuk selamanya di `documentDirectory/offline-photos/`. Field worker akumulasi ratusan MB.

9. **Toast spam** — axios interceptor + useApiMutation onError = 2 toast simultan untuk 1 error. `useAttendanceSubmission` bisa naikkan jadi 3.

10. **UploadService tanpa timeout** — sinyal 4G drop = spinner gantung 5 menit, user force-close = data hilang.

11. **Telemetry blind spot** — hanya attendance ter-track. Work-order, inventory, chat, payment tidak ada observability. Tidak ada Sentry/Crashlytics. Tidak ada correlation ID mobile↔backend.

---

## Top 11 Critical Issues (Block Release)

### C1. Idempotency tidak konsisten di backend
**Severity:** Critical (data integrity, finansial)
**Files:**
- Backend: `app/api/mobile/work-orders/*`, `app/api/mobile/inventory/*`, `app/api/mobile/leaves`
- Mobile: `src/services/SyncService.ts:346-349`

**Root cause:** Hanya `attendance/check-in` & `check-out` punya `AttendanceIdempotencyService` (Redis SETNX, 24h TTL, payload hash, replay cache). Endpoint lain TIDAK punya server-side dedup. SyncService replay payload yang gagal mid-network → backend create duplicate record.

**Skenario reproduksi:**
1. User submit work-order completion offline.
2. Network kembali, SyncService replay.
3. Backend sudah pernah terima request sebelumnya (mid-network drop) → ada record A.
4. Replay create record B (duplicate).
5. Inventory: stok turun 2x. Payroll: leave dihitung 2x.

**Fix:**
1. Buat `lib/api/withIdempotency.ts` middleware di backend mirror pattern attendance.
2. Apply ke: work-order create/update, inventory transactions (barang-masuk, barang-keluar), leave create.
3. Mobile: pindahkan `createAttendanceRequestId` jadi `createRequestId` generic; `useApiMutation` auto-inject untuk semua mutation.
4. Use `expo-crypto.randomUUID()` (bukan `Math.random()`) untuk hindari clock-rollback collision.

**Effort:** 3-5 hari (1 PR backend middleware + apply, 1 PR mobile request-id generalization)

---

### C2. Cross-tenant FCM admin leak
**Severity:** Critical (multi-tenant data leak)
**File:** `netmanager/lib/firebase/messaging.ts:9-29`

```ts
export async function getAdminTokens(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { accessAdminPanel: true }, isActive: true },
    // <-- tidak ada tenantId filter
  });
}
```

Caller di `NotificationService.delivery.ts:172` (`notifyAdmins`) sudah punya `data.siteId` — tinggal extend ke `tenantId`.

**Fix:**
```ts
export async function getAdminTokens(tenantId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { accessAdminPanel: true }, isActive: true, tenantId },
  });
}
```
Plus migration: backfill caller signatures, audit semua `notifyAdmins` call site.

**Effort:** 1 hari

---

### C3. Custom token Firestore tidak pernah refresh
**Severity:** Critical (silent realtime outage)
**File:** `mobile-netmanager/src/services/RealtimeService.ts:23-49, 107-197`

**Root cause:** `authenticateRealtimeClient` hanya cek `auth.currentUser` (identity), tidak cek expiry. Listener Firestore mati senyap setelah ~1 jam. Retry loop spin terhadap token mati, lalu give-up after 5 tries → user lihat data "frozen" tanpa error.

**Fix:**
```ts
// Tambah cek expiry
if (auth.currentUser) {
  try {
    await auth.currentUser.getIdToken(false);
    return;
  } catch {
    await auth.signOut();
  }
}

// Di error handler subscribeToScope:
if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
  resetRealtimeAuthentication();
  await ensureRealtimeAuthenticated();
}
```

**Effort:** 1-2 hari

---

### C4. Logout tidak revoke server-side untuk Employee/Mitra
**Severity:** Critical (security)
**Files:**
- `mobile-netmanager/src/context/AuthContext.tsx:136-150`
- `netmanager/lib/mobile-auth.ts:36-62, 79-88`
- Backend: endpoint `/api/mobile/auth/logout` **tidak ada**

**Root cause:**
- `signOut()` mobile hanya `clearLocalSession()` + best-effort FCM removal.
- Customer punya `tokenVersion` rotation, tapi `signMobileToken` hanya **read**, tidak increment.
- Mitra hardcoded `tokenVersion = 0` (`mobile-auth.ts:41-43`) — tidak ada mekanisme revoke.
- Refresh token tetap valid 30 hari setelah logout.

**Fix:**
1. Tambah endpoint `app/api/mobile/auth/logout/route.ts` yang increment tokenVersion (atau invalidate refresh token list).
2. Mobile: panggil endpoint sebelum `clearLocalSession()`.
3. Migration: tambah kolom `tokenVersion Int @default(0)` di tabel Mitra.

**Effort:** 2 hari

---

### C5. Password plaintext di SecureStore
**Severity:** Critical (credential leak)
**File:** `mobile-netmanager/src/services/CredentialStorageService.ts:8-17`

```ts
await SecureStore.setItemAsync(STORED_PASSWORD_KEY, password);  // plaintext
```

**Implikasi:**
- Android Keystore tanpa `requireAuthentication: true` → bocor di rooted device.
- iOS Keychain default `kSecAttrAccessibleWhenUnlocked` → bisa terbawa via iCloud Keychain backup.
- Password tidak dihapus saat user disable biometric.

**Fix (preferred — Option A):** Server-side biometric session token. Backend issue refresh token khusus dengan flag `biometric_paired:true` saat enroll. Mobile simpan token (BUKAN password) dengan `requireAuthentication: true`.

**Fix (minimum — Option B):**
```ts
await SecureStore.setItemAsync(STORED_PASSWORD_KEY, password, {
  requireAuthentication: true,
  authenticationPrompt: 'Buka brankas kredensial',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

**Effort:** 3 hari (Option A) atau 0.5 hari (Option B sebagai stop-gap)

---

### C6. Geofence bypass via null coordinates
**Severity:** Critical (compliance, abuse)
**Files:**
- Mobile: `src/hooks/queries/useApiMutation.ts:124-153, 241-245`
- Backend: `modules/attendance/services/AttendanceMutationGeofenceService.ts:13-19`

**Root cause:** GPS off → location null → backend skip validation, status `UNKNOWN` → policy STRICT pun bypass.

```ts
// Backend AttendanceMutationGeofenceService.ts:13-19
if (!this.hasCoordinates(params)) {
  return { status: "UNKNOWN", distance: null, siteName: null };
}
```

`assertAllowedGeofence` hanya throw kalau `!isInside && policy === 'STRICT'`. Status `UNKNOWN` lolos.

**Fix:**
```ts
// Backend
if (!this.hasCoordinates(params)) {
  if (policy === 'STRICT') {
    throw new Error("COORDINATES_REQUIRED");
  }
  return { status: "UNKNOWN", distance: null, siteName: null };
}

// Mobile: kalau policy STRICT dan GPS denied, blok tombol check-in
if (geofencePolicy === 'STRICT' && !locationPermission.granted) {
  return showError("Aktifkan GPS untuk check-in");
}
```

**Effort:** 1 hari

---

### C7. DatabaseService bukan SQLite — schema-less queue
**Severity:** Critical (data loss)
**File:** `mobile-netmanager/src/services/DatabaseService.ts:1-256`

**Root cause:** Despite the name, **tidak ada SQLite**. Implementasi adalah:
- In-memory `memoryQueue: SyncQueueItem[]` array
- Persisted ke AsyncStorage via `JSON.stringify` rewrite seluruh blob setiap mutasi
- `Storage.setItem` swallow error silently (`utils/storage.ts:37-43`)

**Implikasi:**
- Setiap `removeFromQueue`/`markAsRetry`/`addToQueue` rewrite seluruh JSON. Dengan 50+ pending item + photo base64 → multi-KB write per status change.
- Saat `SyncQueueItem` interface berubah → parse fail → fallback empty queue → **data offline hilang silently**.
- Tidak ada index, full-table scan in-memory.
- Limit AsyncStorage ~6MB di Android.
- `clearSessionData` saat logout wipe queue → field worker yang force-logout (token expired) kehilangan attendance offline.

**Fix:**
1. Migrasi ke `expo-sqlite` dengan schema versioning + migration runner.
2. **Sebelum migrasi:** hapus `clearSessionData` queue wipe (preserve queue cross-session, scope per `userId`).
3. Surface `setItem` error untuk queue persistence (jangan swallow).

**Effort:** 5-7 hari (migrasi SQLite + test offline scenarios)

---

### C8. Disk leak — `cleanupOfflinePhoto` tidak pernah dipanggil
**Severity:** Critical (UX degrade, disk full)
**File:** `mobile-netmanager/src/utils/persistPhoto.ts:46`

`grep -rn cleanupOfflinePhoto src/ app/` returns **only the export site**. Tidak ada caller. File offline menumpuk selamanya di `documentDirectory/offline-photos/`.

**Tambahan:** photo re-upload tiap retry attempt (`SyncService.ts:284-336`) → orphan files di S3 + bandwidth wasted. Local `body` di-mutate per attempt, tidak cache `photoUrl` antar retry.

**Fix:**
1. Panggil `cleanupOfflinePhoto` di SyncService setelah `removeFromQueue` (success path) untuk setiap persisted photo URI.
2. Cleanup pada TTL expiry (line 251-257).
3. Cache `uploadedPhotos: Record<string, string>` di queue item, persist setelah upload sukses → retry skip re-upload.
4. Startup sweep: list `offline-photos/`, drop file yang tidak referenced di queue.

**Effort:** 2 hari

---

### C9. Double toast pada error
**Severity:** Critical (production UX)
**Files:**
- `mobile-netmanager/src/services/api.ts:155-162` (interceptor toast)
- `mobile-netmanager/src/hooks/queries/useApiMutation.ts:376-382` (onError toast)
- `mobile-netmanager/src/hooks/useAttendanceSubmission.ts:146-149,245-248` (caller catch toast — bisa naikkan jadi 3)

**Trace flow untuk 5xx:**
1. axios interceptor: `showToast('error', 'Masalah Server', ...)` → toast #1
2. useApiMutation onError → `presentAppError` → toast #2
3. `useAttendanceSubmission` catch → toast #3

**Fix:** Pilih satu sumber. Rekomendasi: drop axios interceptor toast, biarkan `useApiMutation` yang menentukan. Atau set `config.skipErrorToast = true` default di `useApiMutation`. Hapus `presentAppError` di `useAttendanceSubmission` catch.

**Effort:** 0.5 hari

---

### C10. UploadService tanpa timeout
**Severity:** Critical (data loss)
**File:** `mobile-netmanager/src/services/UploadService.ts`

`expo-file-system uploadAsync`/`createUploadTask` tidak punya timeout di kode. Sinyal 4G drop di tengah upload foto attendance → spinner gantung 5 menit. User force-close → data hilang.

**Fix:**
```ts
const task = createUploadTask(...);
const timeoutId = setTimeout(() => task.cancelAsync(), HTTP_TIMEOUTS.long);
try { await task.uploadAsync(); } finally { clearTimeout(timeoutId); }

// Plus onProgress watchdog: 10s no progress → abort
```

**Effort:** 0.5 hari

---

### C11. Firestore rules drift — kemungkinan tidak deployed
**Severity:** Critical (security boundary unclear)
**File:** `mobile-netmanager/firestore-rules-update.txt`

**Issue:**
- File bernama `.txt` (bukan `firestore.rules` / `*.rules`)
- Tidak ada pointer di `firebase.json` untuk deploy rules
- Tidak ada `match /chats/{...}/events/{...}` rule (mobile subscribe — silent permission-denied)
- Tidak ada `match /departments/{...}/events/{...}` rule (mobile subscribe — silent permission-denied)
- Backend admin SDK bypass rules — kita tidak tahu apa yang aktual deployed

**Fix:**
1. Rename ke `firestore.rules`.
2. Tambah entry di `firebase.json` `firestore` block.
3. Tambah explicit `allow write: if false` di event collections.
4. Tambah rules untuk `departments` dan `chats` (atau hapus chat scope dari mobile — lihat issue di Appendix 03).

**Effort:** 1 hari + audit konsol Firebase actual rules

---

## High Severity (27 issue) — Ringkasan

Detail lengkap di appendix. Top 10 prioritas:

| # | Issue | File utama | Appendix |
|---|-------|-----------|----------|
| H1 | Refresh single-flight emit `AUTH_UNAUTHORIZED` 5x untuk 5 paralel 401 → blank screen | `api.ts:188-222` | 01 |
| H2 | RefreshTokenService pakai SecureStore raw, inkonsisten dgn SecureStorage wrapper (web fallback rusak) | `RefreshTokenService.ts:116` | 01 |
| H3 | `verifyMobileToken` 2-3 DB query/request tanpa cache (N+1 risk untuk endpoint padat) | `mobile-auth.ts:228-368` | 01 |
| H4 | Mitra tanpa `tokenVersion` mechanism — tidak bisa revoke kecuali soft-delete | `mobile-auth.ts:41-43` | 01 |
| H5 | `chat` scope kind di mobile tapi tidak ada di backend → chat realtime dead end-to-end | `RealtimeService.ts:51-87`, `contracts.ts:30-33` | 03 |
| H6 | `subscribeToScope` `seenDocIds` Set growing tanpa batas + reset on retry → duplicate/lost events + memory leak | `RealtimeService.ts:118-184` | 03 |
| H7 | FCM token tidak `deleteToken()` saat logout → cross-account leak di shared device | `AuthContext.tsx:136-150` | 03 |
| H8 | Custom claims stale sampai re-login → privilege escalation window hari/minggu | `firebase-token/route.ts:28-37` | 03 |
| H9 | Telemetry hanya attendance — work-order/inventory/chat blind spot. Tidak ada Sentry/Crashlytics | `AttendanceTelemetryService.ts`, `package.json` | 04 |
| H10 | Timeout magic number tersebar (60s/15s/10s/5s) tanpa konstanta tunggal | 7 file berbeda | 04 |

Sisanya: queue mutex hole, photo re-upload retry, TTL silent discard, useApiMutation/SyncService race, refresh token tidak handle 426, fingerprint OTA tanpa CI guard, no OTA rollback script, double offline-info toast, online success/fail tidak ter-track, SyncService non-attendance tidak ter-track, listener leak `useProfileSync`, `RealtimeProvider.disconnect` tidak `signOut`, `messaging` admin SDK null deref, dst.

---

## Tabel Prioritas Eksekusi

### Sprint 1 — Block Release (1-2 minggu)
Kerjakan **paralel** karena minim coupling:

| ID | Title | Effort | Owner area |
|----|-------|--------|-----------|
| C1 | Idempotency middleware untuk WO/inventory/leave | 3-5h | backend + mobile |
| C2 | Cross-tenant FCM filter | 1h | backend |
| C5 (B) | Biometric storage stop-gap (`requireAuthentication`) | 0.5h | mobile |
| C6 | Geofence STRICT + null coords reject | 1h | backend + mobile |
| C8 | Photo cleanup wiring | 2h | mobile |
| C9 | Toast deduplication | 0.5h | mobile |
| C10 | Upload timeout | 0.5h | mobile |
| C11 | Firestore rules deploy + chat decision | 1h | infra |

**Total Sprint 1:** ~10-13 hari kerja, bisa diselesaikan 1 engineer dalam 2 minggu, atau 2 engineer dalam 1 minggu.

### Sprint 2 — Hardening (2-3 minggu)
| ID | Title | Effort |
|----|-------|--------|
| C3 | Custom token refresh + auth invalidation | 1-2h |
| C4 | Logout endpoint + tokenVersion increment Employee/Mitra | 2h |
| C7 | Migrasi DatabaseService → expo-sqlite | 5-7h |
| H1 | Throttle/debounce `AUTH_UNAUTHORIZED` emit | 0.5h |
| H5 | Decision: fix chat realtime atau drop scope | 3-5h |
| H7 | FCM `deleteToken` on logout | 0.5h |
| H8 | Custom claims rotation on role change | 1-2h |
| H9 | Sentry RN setup + generalize TelemetryService | 3-5h |
| H10 | Konsolidasi `lib/timeout.ts` | 0.5h |

**Total Sprint 2:** ~17-25 hari kerja.

### Sprint 3 — Hygiene (1-2 minggu)
| ID | Title | Effort |
|----|-------|--------|
| C5 (A) | Biometric server-side session token (full fix) | 3h |
| H2-H4, H6 | Auth/realtime hardening | 2-3h |
| Medium issues bulk | Korrelation ID, geofence enum konsolidasi, API versioning | 5-7h |

---

## Risk Matrix — Production Incident Probability

| Risk | Likelihood | Impact | Detection di production hari ini |
|------|-----------|--------|----------------------------------|
| Toast spam (C9) | Sering | Rendah-medium | User complaint; sudah pasti terjadi pada 5xx burst |
| Upload hang (C10) | Sering | Tinggi | Force close → data hilang; tidak ter-track (no telemetry) |
| Geofence bypass (C6) | Jarang | Tinggi (compliance) | Audit attendance tidak akan menangkap karena status `UNKNOWN` lolos |
| Idempotency duplicate (C1) | Medium | Tinggi (financial) | Sulit dideteksi; muncul sebagai "data ganda misterius" di laporan |
| Cross-tenant FCM (C2) | Setiap kali notifikasi admin | Tinggi (privacy) | Tidak ada alert; ditemukan kalau customer report |
| Realtime frozen (C3) | Setiap session > 1h | Medium-tinggi | User restart app sebagai "fix"; support tidak tahu |
| Schema-less queue corruption (C7) | Setiap deploy yang ubah `SyncQueueItem` | Sangat tinggi | **Silent**; offline data hilang tanpa error |
| FCM cross-account (H7) | Sering di shared device | Tinggi (privacy) | Tidak ada audit; user complaint |

**Risiko paling under-the-radar:** C7 (schema-less queue), C2 (cross-tenant FCM), C6 (geofence bypass) — tidak akan terdeteksi otomatis. Wajib fix sebelum next deploy yang touch `SyncQueueItem` atau notification flow.

---

## Rekomendasi Workflow

1. **Buat 1 epic** "Mobile Integration Hardening Q2-2026" di tracker.
2. **Sub-tickets per Critical** (11 ticket); link ke section masing-masing di appendix.
3. **Wajib regression test plan** untuk:
   - Idempotency: test dual-submit → expect 1 record + replay response
   - Geofence: test null coords + STRICT → expect 422
   - Logout: test refresh token after logout → expect rejected
   - Schema migration: test queue dengan SyncQueueItem v1 → upgrade ke v2 → no data loss
4. **Pasang Sentry RN sebelum Sprint 2** — semua fix di Sprint 2-3 perlu telemetry untuk verifikasi production.
5. **Audit Firebase Console** rules secara manual sebelum apply C11 — pastikan tidak ada rule lebih permissive yang sedang aktif.

---

## Catatan untuk Verifikasi

Beberapa hal di appendix berasal dari **inferensi static analysis** dan perlu dikonfirmasi runtime:
- Apakah `AUTH_UNAUTHORIZED` emit ganda benar menyebabkan blank screen di production? — perlu reproduksi.
- Apakah Firebase Console rules sebenarnya lebih permissive atau lebih ketat dari `firestore-rules-update.txt`? — perlu cek manual.
- Apakah ada user report "data realtime frozen setelah jam 1"? — perlu cek support ticket.
- Apakah ada laporan duplicate work-order/inventory? — perlu query DB untuk pattern duplicate.

---

*File ini adalah ringkasan eksekutif. Detail file path, line number, code snippet, dan fix proposal lengkap ada di 4 appendix.*
