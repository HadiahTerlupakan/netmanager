# Deep Review — Cross-Cutting Concerns (mobile-netmanager + backend)

Tanggal: 2026-05-18
Scope: error handling, telemetry, timeout, geofence, versioning, build/release.

---

## 1. ERROR HANDLING DUPLICATION

### 1.1 [CRITICAL] Double toast pada network error & 5xx untuk semua mutation

**File 1:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:155-162`
```ts
// Critical Error Feedback (UX Improvement)
if (!config.skipErrorToast) {
  if (!error.response) {
    showToast('error', 'Masalah Koneksi', 'Mohon periksa koneksi internet Anda.');
  } else if (error.response.status >= 500) {
    showToast('error', 'Masalah Server', 'Terjadi gangguan pada server. Tim kami sedang menanganinya.');
  }
}
```

**File 2:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/queries/useApiMutation.ts:376-382`
```ts
if (showErrorAlert) {
  presentAppError(error, {
    source: "mutation",
    route: typeof endpoint === "function" ? endpoint(variables) : endpoint,
    report: false,
  });
}
```

**Trace flow untuk satu network error:**
1. POST `/api/mobile/attendance/check-in`
2. `axios.interceptors.response` rejection → `showToast('error', 'Masalah Koneksi', ...)` (toast #1)
3. `useApiMutation.mutationFn` catch → karena `isNetworkError` benar, masuk cabang offline-queue (no throw, no toast).
4. **TAPI** kalau cabang offline gagal di-queue (DB error) atau bukan attendance/photoMap/POST yang punya offline path: error rethrown.
5. `useApiMutation.onError` → `presentAppError` (toast #2)

Untuk **5xx error pada online mutation** (misal POST work-order completion):
1. axios interceptor: `showToast('error', 'Masalah Server', ...)` (toast #1)
2. mutationFn rethrow (bukan network error, bukan 'Offline')
3. useApiMutation onError → presentAppError → backend message via `extractApiErrorMessage` → toast #2

**Confirmed: 2 toast simultan untuk 5xx; 1-2 toast untuk network (tergantung apakah masuk offline queue).** Toast spam memperburuk UX dan menutupi pesan backend asli.

`useAttendanceSubmission.ts:146-149,245-248` juga memanggil `presentAppError` di catch block. Bila mutation memunculkan toast lewat `onError` lalu rethrow ke caller (`mutateAsync`), caller juga dipanggil → potensi **3 toast** (axios + onError + caller catch).

**Root cause:** dua "error presentation layer" diaktifkan paralel. Interceptor dipikir sebagai "global safety net," tapi tidak pernah dimatikan saat `useApiMutation` aktif.

**Severity:** Critical (production UX)

**Fix proposal:**
- Pilih satu sumber kebenaran. Saya rekomendasikan **drop axios interceptor toast** dan biarkan `useApiMutation`/`useApiQuery` (atau caller hook) yang menentukan kapan dan apa yang ditampilkan.
- Atau, kalau ingin global fallback: set `config.skipErrorToast = true` secara default di `useApiMutation` request (atau di setiap hook query/mutation), dan pakai axios toast hanya untuk request yang tidak melalui hook (mis. RefreshTokenService/UploadService).
- Hapus `presentAppError` di `useAttendanceSubmission` catch block, karena `mutation.onError` (showErrorAlert default true) sudah menanganinya. Bila tetap ingin handle screen-specific, set `showErrorAlert: false` di mutation options.

---

### 1.2 [HIGH] `presentInfoMessage` ganda pada offline queue

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/queries/useApiMutation.ts:342-356` + `src/hooks/useAttendanceSubmission.ts:137-142,202-207`

`useApiMutation.onSuccess` menampilkan `presentInfoMessage` saat hasil berupa offline-queued. Tetapi `useAttendanceSubmission` *juga* memeriksa `isOfflineMutationQueuedResult(data)` dan memanggil `presentInfoMessage` ke-2.

Kalau mutation diset dengan `successMessage` atau `showErrorAlert` default, toast offline muncul dua kali.

**Severity:** High

**Fix:** Hapus salah satu — sebaiknya hapus dari `useAttendanceSubmission`, karena `useApiMutation` sudah generic.

---

### 1.3 [MEDIUM] Toast 5xx tetap muncul walau request sedang di-retry

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:155-180`

Interceptor menampilkan toast `'Masalah Server'` SEBELUM retry block dievaluasi. Bila request 5xx di-retry dan akhirnya sukses, user sudah terlanjur lihat toast error padahal request ujung-ujungnya sukses.

**Severity:** Medium

**Fix:** Pindahkan toast ke setelah keputusan "tidak retry lagi" — yaitu di akhir interceptor sebelum reject, atau drop sepenuhnya (lihat 1.1).

---

## 2. TELEMETRY COVERAGE

### 2.1 [HIGH] Telemetry hanya untuk attendance — modul lain blind

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/AttendanceTelemetryService.ts`

Hanya 11 event hard-coded untuk attendance flow. Tidak ada telemetry untuk:
- work-order submission/completion
- inventory barang masuk/keluar
- chat message send/receive
- registration submit
- payment/finance
- sync queue depth global

**Severity:** High

**Fix proposal:**
- Generalize jadi `TelemetryService` dengan `track(event: string, props: Record<string, unknown>)`.
- Buat namespace per modul: `wo.submit_started`, `inventory.in_succeeded`, dll.
- Pipe ke `ErrorReportingService.addBreadcrumb` agar otomatis ikut payload error report ke backend.

---

### 2.2 [HIGH] Online success/fail di axios tidak tertelemetri secara terstruktur

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/api.ts:131-153`

Hanya `performanceMonitor.start/stop` (in-memory, dibuang saat process restart). Tidak ada upload ke backend, tidak ada breadcrumb ke ErrorReportingService.

`useApiMutation.mutationFn` track sukses/gagal *hanya untuk attendance endpoint* (line 214-220, 262-268, 322-328).

**Severity:** High — production blind spot

**Fix:** Kirim breadcrumb di `api.interceptors.response` untuk semua request:
```ts
errorReportingService.addBreadcrumb('api', `${config.method} ${config.url}`, {
  status: response.status,
  durationMs: performance.now() - (config.metadata?.startTime ?? 0),
});
```
Sama untuk error path.

---

### 2.3 [HIGH] Offline submission via SyncService — telemetry partial

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/SyncService.ts:364-485`

Telemetry hanya nyala untuk URL yang `includes('/attendance/')`. Item work-order/inventory yang gagal sync **tidak di-track**, hanya `logger.warn`. Permanent failure (4xx) di-display ke user via toast tapi **tidak dikirim ke backend telemetry**.

**Severity:** High

**Fix:**
- Pakai TelemetryService generic per item `processQueueItem`.
- Track minimal: `sync.queued`, `sync.attempt`, `sync.succeeded`, `sync.permanent_failed`, `sync.expired_ttl`, `sync.dropped` per kategori URL.
- Track queue depth tiap N detik (background heartbeat) → backend dapat lihat kalau ada device dengan ratusan pending item.

---

### 2.4 [MEDIUM] Tidak ada Sentry/Crashlytics — JS unhandled rejection lolos

**File:** `package.json` — tidak ada `@sentry/react-native`, `@sentry/expo`, atau `@react-native-firebase/crashlytics`.

`ErrorReportingService` hanya kirim ke endpoint `/api/mobile/error-report` ketika `presentAppError` dipanggil dengan `report: true` (default jika `presentation.reportable === true`). Native crash & unhandled JS rejection tidak ter-capture, dan kalau app crash sebelum sempat POST, payload hilang.

**Severity:** High (production debugging)

**Fix:** Pasang Sentry React Native (atau RNFirebase Crashlytics — RNFirebase Messaging sudah dipakai). Aktifkan native crash reporting + JS errorBoundary.

---

### 2.5 [MEDIUM] Tidak ada correlation ID antara mobile dan backend

**File:** `/Users/rohadimraja/Documents/radpro/netmanager/lib/api/handler.ts` & seluruh `lib/`

Grep `X-Correlation-Id|X-Request-Id|correlationId` di backend code lib/middleware: **0 hits**. Hanya `requestId` ada di sub-domain attendance idempotency (POST body, bukan request header global).

Ketika user lapor "transaksi gagal jam 14:23", tidak ada cara cepat untuk korelasi log mobile ↔ log backend.

**Severity:** Medium

**Fix:**
- Mobile: tambahkan interceptor request `config.headers['X-Request-Id'] = uuid()`. Sertakan di error report payload `context.requestId`.
- Backend: middleware (atau di `lib/api/handler.ts`) baca header `X-Request-Id`; kalau kosong, generate; tulis ke MDC `logger`. Kembalikan sebagai response header agar mobile bisa lihat.

---

### 2.6 [LOW] User journey breadcrumb tidak ditambahkan secara sistematis

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/ErrorReportingService.ts:248-263`

API `addBreadcrumb` ada, tapi grep di src/ menunjukkan jarang dipakai. Login, navigation, bottom-tab change, attendance check-in — tidak ada breadcrumb.

**Severity:** Low (tapi nilai investasi tinggi)

**Fix:** Tambah breadcrumb hook di `expo-router` navigation listener, di axios interceptor, di setiap mutation start/success.

---

## 3. TIMEOUT CONSISTENCY

| Lokasi | File:Line | Nilai | Kategori |
|---|---|---|---|
| Global axios | `services/api.ts:68` | 60000 ms | Default semua request |
| useApiMutation | `hooks/queries/useApiMutation.ts:258` | 15000 ms | Override per-call (pernah dengar 15s "for mobile networks") |
| SyncService replay | `services/SyncService.ts:15,356` | 15000 ms | Background sync |
| ErrorReportingService | `services/ErrorReportingService.ts:55,114` | 5000 ms | Self-report |
| RefreshTokenService | `services/RefreshTokenService.ts:104` | 10000 ms | Token refresh |
| LocationTracking POST | `services/LocationTrackingService.ts:331` | 10000 ms | Location heartbeat |
| LocationTracking init | `services/LocationTrackingService.ts:416` | 30000 ms | Init flow |
| Location getCurrentPosition | `useApiMutation.ts:124-141`, `useLocationWithTimeout.ts:23-40` | 5000 ms | Race timeout (manual) |
| UploadService.uploadAsync | `services/UploadService.ts` | **TIDAK ADA** | expo-file-system upload |
| UploadService.deleteUploadedFile | `services/UploadService.ts:173` | **TIDAK ADA** | fetch call |
| Firestore listeners (RealtimeService/PresenceService) | — | **TIDAK DIATUR** | SDK default (~10s connect) |

### 3.1 [HIGH] Konflik timeout: global 60s vs per-mutation 15s

**File:** `useApiMutation.ts:258` set `timeout: 15000`.

Comment di axios bilang "60s untuk match backend long-running tasks." Tapi semua mutation override ke 15s. Berarti POST yang punya server-side operation berat (misal generate PDF invoice) akan timeout di 15s — kecuali request itu pakai `api.post` langsung (bukan via useApiMutation).

`payment.service` di backend sebagian ada operasi 20-30s (transaction lock + RADIUS sync). Mobile akan timeout duluan.

Tambahan: Background offline replay juga 15s (line 356 SyncService) — kalau backend lambat, replay terus retry → DB churn.

**Severity:** High

**Fix:**
- Konsolidasi: definisikan konstanta tunggal di `lib/timeout.ts`:
  ```ts
  export const HTTP_TIMEOUTS = {
    short: 10_000,    // ping, version check, error report
    standard: 30_000, // CRUD biasa
    long: 60_000,     // upload, payment, complex query
  };
  ```
- Hapus magic number 15000 dari useApiMutation; gunakan `HTTP_TIMEOUTS.standard`.
- Hapus magic number 60000 dari axios global; pakai `HTTP_TIMEOUTS.standard`.
- Untuk endpoint berat (payment, generate report), per-call override ke `HTTP_TIMEOUTS.long`.

### 3.2 [CRITICAL] UploadService tidak punya timeout

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/UploadService.ts`

`expo-file-system` `uploadAsync`/`createUploadTask` tidak punya parameter timeout di kode. Bila koneksi 4G drop di tengah upload foto attendance, request akan **menggantung** sampai TCP timeout OS (bisa 60-300 detik).

User akan lihat spinner "Mengupload foto..." selama 5 menit tanpa feedback. Kalau dia lock screen, OS bisa kill request — tapi state aplikasi tidak tahu.

**Severity:** Critical

**Fix:**
- Bungkus dengan AbortController + setTimeout:
  ```ts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUTS.long);
  // pass signal ke upload options... atau pakai uploadTask.cancelAsync()
  ```
- expo-file-system `createUploadTask` punya `cancelAsync()`. Pasang setTimeout(cancel, 60000).
- Tambah `onProgress` watchdog: kalau 10s tidak ada progress, abort.

### 3.3 [MEDIUM] Race timeout location 5s di hot-path attendance

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/hooks/queries/useApiMutation.ts:124-153`

Location 5s timeout dipakai di `useApiMutation` saat `includeLocation: true`. Bila GPS lemah (indoor), location null akan dikirim ke backend. Backend `AttendanceMutationGeofenceService:13-19` deteksi `!hasCoordinates` → status 'UNKNOWN' → policy `WARN` (default) → allow.

**Konsekuensi**: user di luar area bisa lolos check-in dengan policy WARN cukup dengan tunggu sampai GPS timeout. Bypass tidak intentional — tapi exploitable.

**Severity:** Medium (security boundary)

**Fix:**
- Naikkan timeout ke 15-20s (GPS first fix di luar bisa 10s).
- Tampilkan pesan "Mengambil lokasi..." dan jangan submit kalau location null untuk policy STRICT — back off ke user retry, jangan diam-diam kirim null.
- Backend untuk policy STRICT: tolak `!hasCoordinates` dengan 422.

### 3.4 [LOW] ErrorReportingService 5s timeout — agak ketat untuk koneksi marginal

**File:** `services/ErrorReportingService.ts:55`

Self-report 5s. Kalau jaringan lambat, error report sendiri silently fail → ironis.

**Severity:** Low

**Fix:** Naikkan ke 10s; kalau timeout, simpan ke local queue untuk dikirim later.

---

## 4. GEOFENCE VALIDATION DUPLICATE

### 4.1 [HIGH] Mismatch policy mobile vs backend

**Mobile:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/utils/attendanceGeofencePolicy.ts:1-22`
```ts
export type AttendanceGeofencePolicy = 'STRICT' | 'WARN' | 'DISABLED';
```
Mobile expose 3 nilai.

**Backend:** `/Users/rohadimraja/Documents/radpro/netmanager/modules/attendance/services/AttendanceMutationGeofenceService.ts:66-70`
```ts
private assertAllowedGeofence(isInside: boolean, policy?: string | null) {
  if (!isInside && (policy ?? "WARN") === "STRICT") {
    throw new Error("OUTSIDE_GEOFENCE");
  }
}
```
Backend hanya recognize `'STRICT'`. Nilai `'DISABLED'` di backend default ke `'WARN'` semantically (tidak blok). Tetapi backend tidak pernah baca string `'DISABLED'` secara explicit — kalau policy null, fallback `'WARN'` sama dengan `'DISABLED'`. Konsisten by accident, tapi rapuh.

**Severity:** Medium

**Fix:** Buat `lib/geofencePolicy.ts` di backend yang mirror enum mobile, dan validate di Zod schema attendanceGeofencePolicy hanya menerima 3 nilai itu. Tambahkan unit test mismatch matrix.

### 4.2 [HIGH] Bypass: skip GPS → null coords → backend allow walaupun di luar area

**File mobile:** `useApiMutation.ts:241-245`
```ts
if (includeLocation) {
  const { latitude, longitude } = await getCurrentLocation();
  payload.latitude = payload.latitude ?? latitude;
  payload.longitude = payload.longitude ?? longitude;
}
```

**File backend:** `AttendanceMutationGeofenceService.ts:13-19`
```ts
if (!this.hasCoordinates(params)) {
  return {
    status: "UNKNOWN",
    distance: null,
    siteName: null,
  };
}
```
Status 'UNKNOWN' tidak masuk `assertAllowedGeofence` → tidak pernah throw → check-in lolos walau di luar area, dan mode policy STRICT pun bypass.

**Reproduksi:**
1. User non-aktifkan GPS atau matikan permission location.
2. Mobile `getCurrentLocation` return `{ latitude: null, longitude: null }`.
3. Backend skip validation, status `UNKNOWN` masuk DB.
4. Audit attendance terlihat normal "OK" tapi sebenarnya di luar area.

**Severity:** High (compliance & abuse)

**Fix:**
- Backend untuk policy STRICT: `if (!hasCoordinates && policy === 'STRICT') throw 'COORDINATES_REQUIRED'`.
- Mobile UI: kalau policy STRICT dan location permission denied, blok tombol check-in dengan instruksi enable GPS.
- Tambahkan flag `geofenceStatus: 'UNKNOWN'` di laporan absensi agar admin tahu lokasi tidak terverifikasi.

### 4.3 [MEDIUM] Mobile validate `isInside` di client tapi keputusan lokasi tetap di backend

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/components/organisms/attendance/geofenceUtils.ts`

Mobile compute `isInside` lokal (Haversine) untuk feedback UI (warning modal). Tapi koordinat geofence diambil dari backend — bisa stale di cache. Bila admin update radius site di backend, mobile pakai cached value sampai refresh.

Tidak fundamental issue — backend tetap source of truth — tapi mismatch (mobile bilang inside, backend bilang outside) bisa bingungkan user.

**Severity:** Low-Medium

**Fix:** Mobile tampilkan "Lokasi divalidasi server" dan tunggu response. Hindari memberi false confidence di UI.

---

## 5. VERSIONING & MIGRATION

### 5.1 [CRITICAL] Tidak ada SQLite migration — DatabaseService pakai AsyncStorage

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/src/services/DatabaseService.ts:1-100`

```ts
import { Storage } from "@/utils/storage";
const QUEUE_KEY = "NETMANAGER_SYNC_QUEUE";
// ...
this.memoryQueue = JSON.parse(json);
```

**Konsekuensi:**
- Tidak ada schema versioning. Bila struktur `SyncQueueItem` berubah (mis. tambah field `tenantId`), data lama dari user yang tidak buka app dalam 2 minggu akan parse error → fallback ke empty queue → **data offline hilang**.
- Tidak ada index, full-table scan in-memory.
- Queue dibatasi ukuran AsyncStorage (~6MB di Android, varies). User dengan 500 item offline bisa kena limit.

**Severity:** Critical

**Fix:**
- Migrasi ke `expo-sqlite` (sudah lazimnya untuk offline-first apps).
- Tambah versioning field di tiap row (`schemaVersion`).
- Migration runner di `initDatabase`: bandingkan version → jalankan upgrade script.

### 5.2 [HIGH] App version gate kirim 426, tapi RefreshTokenService skip 426 path

**File backend:** `lib/api/handler.ts:163-181`, `app/api/mobile/auth/refresh/route.ts:47`
**File mobile:** `services/api.ts:167-171`
```ts
if (error.response?.status === 426) {
  DeviceEventEmitter.emit(Events.APP_VERSION_UNSUPPORTED, error.response.data);
  return Promise.reject(error);
}
```

Mobile listen event di app shell dan tampilkan force-update modal. **Tetapi**:
1. Refresh token route (`/api/mobile/auth/refresh`) juga return 426 — ini terlihat di test. Kalau token expired DAN versi unsupported, mobile akan dapat 401 → trigger refresh → refresh return 426 → di axios interceptor 426 di-emit.
2. Tetapi 426 dari refresh **datang sebagai response dari refresh request itu sendiri**, bukan dari original request. `RefreshTokenService.refreshAccessToken` di line 104 menggunakan timeout 10000 — kalau gagal akan return null, dan request asli akhirnya emit `AUTH_UNAUTHORIZED`. User dipikir kena logout, padahal sebenarnya butuh update.

**Severity:** High (UX confusion)

**Fix:** `RefreshTokenService` harus deteksi 426 secara eksplisit dan re-emit `APP_VERSION_UNSUPPORTED`, bukan pakai default null path.

### 5.3 [MEDIUM] API versioning strategy belum ada

Grep `/api/mobile/v1\|/api/mobile/v2`: tidak ada versioning di path. Semua endpoint di `/api/mobile/*`. Saat schema berubah breaking, satu-satunya mekanisme adalah min-version-code. Itu memaksa force-update — bukan staged migration.

**Severity:** Medium

**Fix:**
- Tetapkan policy: minor changes additive di `/api/mobile/*` (server kompatibel mundur N versi).
- Kalau breaking diperlukan, route `/api/mobile/v2/*` dan biarkan v1 hidup sampai semua user di-force-update.

### 5.4 [HIGH] runtimeVersion = fingerprint — risiko OTA breaking pada deps update kecil

**File:** `app.json:10-12`
```json
"runtimeVersion": { "policy": "fingerprint" }
```

Fingerprint termasuk `package.json`, native modules, dan plugin config. Tambah dependency JS-only (mis. `dayjs`) bisa juga ubah fingerprint → OTA tidak akan disebar ke build lama → user perlu APK rebuild.

Kebalikan, fingerprint *bisa* lolos perubahan yang seharusnya butuh native rebuild (rare bug expo-fingerprint).

**Severity:** Medium-High

**Fix:**
- Sebelum publish OTA, jalankan `npx expo-fingerprint diff <last-build-commit> HEAD` (sudah disebut di CLAUDE.md, tapi proses manual).
- Tambahkan check di CI:
  ```yaml
  - run: |
      DIFF=$(npx expo-fingerprint diff $LAST_BUILD_SHA HEAD)
      if echo "$DIFF" | grep -q "different"; then
        echo "Native fingerprint changed — APK rebuild required"
        exit 1
      fi
  ```

---

## 6. BUILD & RELEASE PIPELINE

### 6.1 [CRITICAL] Firebase API key + project IDs commit di eas.json

**File:** `/Users/rohadimraja/Documents/radpro/mobile-netmanager/eas.json:11-49`

```json
"EXPO_PUBLIC_FIREBASE_API_KEY": "AIzaSyDihrl023fOQnXf8oZ7A2rU7YxzJzQN5Lc",
```

Web Firebase API key, sama untuk dev/staging/prod (tunggal). Walaupun Firebase API key publik secara desain, sharing antar environment menyatukan blast-radius — bila staging RTDB dipakai abuse, prod database juga kena.

**Severity:** Medium-High (segregation)

**Fix:**
- Pakai project Firebase terpisah untuk staging vs production.
- Pindahkan ke EAS secrets (`eas secret:create`) bukan di `eas.json` ter-commit.

### 6.2 [HIGH] Tidak ada explicit rollback strategy untuk OTA

Grep `eas update --branch staging --rollback`: tidak ditemukan di repo (`scripts/` & `Jenkinsfile.ota`).

**Konsekuensi:** Bila OTA bug critical, satu-satunya cara adalah publish OTA baru. Tapi kalau OTA baru itu juga buggy (uji sample kecil), tidak ada one-button rollback ke build APK terakhir yang sehat.

**Severity:** High

**Fix:**
- Catat fingerprint setiap APK release.
- Saat publish OTA, simpan `eas update:list` ID terakhir per branch.
- Buat script `scripts/ota-rollback.sh` yang `eas update:republish --group <previous-id>`.

### 6.3 [MEDIUM] APK bundled dengan ratusan APK lama di repo root

```
netman_staging.apk
netman_staging_v1.0.2_build3.apk
netman_staging_v1.0.3_build4.apk
... 
netman_staging_v1.0.8_build2.apk
```

8 file APK di root. Bloat git size, tidak ada strategy untuk hapus.

**Severity:** Low (housekeeping)

**Fix:** Hapus dari git, pindahkan ke storage release artifact (S3/EAS asset).

### 6.4 [MEDIUM] EAS update OTA vs APK rebuild — tidak ada hook automatis

CLAUDE.md sebut `runtimeVersion.policy = "fingerprint"` auto-detect. Tetapi tidak ada CI guard yang block `eas update` saat fingerprint berbeda dari build APK terbaru — engineer bisa keliru push OTA yang seharusnya APK.

**Severity:** Medium

**Fix:** Lihat 5.4 — pasang fingerprint diff check di CI sebelum allow `eas update`.

### 6.5 [HIGH] Tidak terlihat Jenkinsfile.ota content untuk verifikasi

**File:** `Jenkinsfile.ota` exists tapi tidak diaudit di review ini. Sangat mungkin sudah handle OTA workflow, tapi:
- Tidak ada cross-reference dengan `app-version` module backend yang gating min version.
- Tidak ada test smoke deployment otomatis pre-promote.

**Severity:** Medium (assumed-OK)

**Fix:** Audit Jenkinsfile.ota terpisah; tambah step yang verify backend `mobile-min-version` setelah build sukses.

---

## RINGKASAN PRIORITAS

### Critical (segera dikerjakan, production-impact)
1. **1.1** Double toast on network/5xx errors → drop interceptor toast atau `skipErrorToast` default true.
2. **3.2** UploadService tanpa timeout → bungkus dengan AbortController + setTimeout(60s).
3. **5.1** AsyncStorage queue tanpa schema versioning → migrasi ke expo-sqlite + migration runner.
4. **6.1** Firebase keys + project shared antar env → pisah project + EAS secrets.

### High
5. **1.2** Double offline-info toast → hapus dari useAttendanceSubmission.
6. **2.1** Telemetry attendance-only → generalize TelemetryService.
7. **2.2** Online success/fail axios tidak ter-track → tambah breadcrumb.
8. **2.3** SyncService non-attendance tidak ter-track → telemetry generic per item.
9. **2.4** Tidak ada Sentry/Crashlytics → pasang Sentry RN.
10. **3.1** Timeout 15s mutation vs 60s axios global → konstanta tunggal.
11. **4.2** Geofence bypass via null coords → backend tolak STRICT + null coords.
12. **5.2** RefreshToken flow tidak handle 426 → tambah explicit 426 handler.
13. **5.4** Fingerprint OTA tanpa CI guard → tambah expo-fingerprint diff check.
14. **6.2** Tidak ada OTA rollback script → buat scripts/ota-rollback.sh.

### Medium
15. **1.3** Toast 5xx muncul saat sebenarnya berhasil retry → reorder atau drop.
16. **2.5** Correlation ID antara mobile-backend → tambahkan `X-Request-Id`.
17. **3.3** Location 5s timeout → 15-20s.
18. **3.4** ErrorReporting timeout 5s → naikkan + queue.
19. **4.1** Mismatch enum geofencePolicy → konsolidasi.
20. **4.3** Geofence client-side caching → tampilkan "validated by server".
21. **5.3** API versioning strategy → /v1 path scheme.
22. **6.3** APK lama di git → pindahkan ke release artifact.
23. **6.4** EAS update tanpa fingerprint guard.
24. **6.5** Jenkinsfile.ota perlu audit terpisah.

### Low
25. **2.6** User journey breadcrumb sistematis.

---

## RISIKO PRODUCTION INCIDENT TERTINGGI

1. **Toast spam** (1.1) — sudah pasti terjadi saat backend 5xx; user fatigue, support ticket meledak.
2. **Upload hang** (3.2) — sudah pasti terjadi saat sinyal 4G drop di tengah upload; user lihat spinner > 1 menit, mungkin force-close → kehilangan data attendance.
3. **Geofence bypass** (4.2) — exploitable oleh karyawan: matikan GPS → check-in dari mana saja. Compliance & abuse.
4. **Schema-less queue** (5.1) — saat field di-tambah, semua data offline existing user **hilang silently** karena parse fail → fallback empty queue.
5. **No correlation ID** (2.5) — saat insiden, support tidak bisa korelasi log mobile ↔ backend, MTTR melar.
