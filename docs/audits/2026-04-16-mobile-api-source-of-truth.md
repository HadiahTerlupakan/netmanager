# Mobile API Source of Truth

Tanggal: 2026-04-16
Status: Draft audit baseline
Scope: `mobile-netmanager` sebagai consumer, `netmanager` sebagai provider API

## 1) Tujuan

Dokumen ini menjadi source of truth untuk semua endpoint API yang **benar-benar dipakai** oleh mobile app `mobile-netmanager`, termasuk endpoint di luar surface `/api/mobile/*`.

Dokumen ini dipakai untuk:
- memetakan caller mobile ke route backend yang nyata,
- mengidentifikasi gap/stale endpoint,
- menandai auth mode dan kontrak response,
- memprioritaskan remediation dan test coverage.

## 2) Ringkasan Eksekutif

Temuan utama audit:

1. Scope mobile **tidak terbatas** pada `/api/mobile/*`.
   Mobile app juga aktif memakai `/api/customer/*`, `/api/marketing/*`, `/api/integrations/mixradius/*`, `/api/map/*`, dan `/api/coupons/verify`.
2. Surface `/api/mobile/*` mayoritas sudah punya route backend yang valid.
3. Ada tiga gap prioritas tinggi:
   - `/api/mobile/auth/refresh` dipakai client tetapi route backend belum terdeteksi.
   - `/api/mobile/work-orders/complete` dipakai client tetapi route backend belum terdeteksi.
   - `GET /api/mobile/announcements` dipakai client tetapi route backend belum terdeteksi.
4. Kontrak response belum sepenuhnya konsisten. Sebagian endpoint memakai envelope `data`, tetapi beberapa endpoint mengembalikan shape khusus.
5. Coverage test sudah cukup baik di attendance, work-order request/update, notifications, upload, FCM, MixRadius customer, error report, dan app-version report, tetapi masih tipis di auth, profile, chat, mitra, inventory, dan beberapa endpoint non-mobile yang dipakai app.

## 3) Konvensi Status

- `match`: caller mobile punya route backend yang cocok.
- `match-special-contract`: route ada, tetapi kontrak response berbeda dari pola umum `response.data.data`.
- `missing-backend`: client memanggil endpoint tetapi route backend belum ditemukan.
- `backend-exists-caller-unclear`: route backend ada, tetapi caller runtime mobile aktif tidak terdeteksi.
- `security-review`: route ada, tetapi perlu audit keamanan/otorisasi lebih dalam.

## 4) Pola Auth dan Kontrak Response

### 4.1 Pola auth client mobile

Consumer utama:
- `mobile-netmanager/src/services/api.ts`
- `mobile-netmanager/src/context/AuthContext.tsx`
- `mobile-netmanager/src/services/RefreshTokenService.ts`

Pola yang diandalkan mobile:
- Access token dikirim lewat `Authorization: Bearer <token>`.
- Client memakai base URL dinamis via `TenantService.getTenantUrl()`.
- 401 memicu refresh token flow.
- 426 diperlakukan sebagai app version unsupported.
- Banyak consumer mengandalkan payload di `response.data.data`.

### 4.2 Pola auth backend

Provider utama:
- `netmanager/lib/api/handler.ts`
- `netmanager/lib/mobile-auth.ts`
- `netmanager/lib/hybrid-auth.ts`
- `netmanager/lib/rbac.ts`

Pola yang terdeteksi:
- Route modern banyak memakai `createHandler({ auth: true })`.
- Mobile bearer token diverifikasi lewat helper auth mobile.
- Beberapa route masih memakai handler custom/manual, bukan `createHandler`.
- RBAC/permission enforcement ada, tetapi tidak semua route mobile mengikuti jalur helper yang sama.

### 4.3 Catatan kontrak response

Pola umum yang paling aman untuk mobile adalah:
- success: `success: true`, `data: ...`
- error: `success: false`, `error`, `code`, optional `details`

Pengecualian penting:
- `POST /api/mobile/auth/login` mengembalikan `success + token + user`, bukan `data`.
- `POST /api/mobile/announcements/{id}/read` mengembalikan `success + read`, bukan `data`.
- `GET /api/mobile/announcements` di client malah diharapkan mengembalikan **raw array**, tetapi route backend listing tidak ditemukan.

## 5) Source of Truth Matrix — `/api/mobile/*`

| Method | Path | Caller mobile | Backend route | Auth | Contract | Coverage | Status | Catatan |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/mobile/auth/login` | `app/(auth)/login.tsx` | `app/api/mobile/auth/login/route.ts` | Public | `success + token + user` | Belum terlihat route test langsung | `match-special-contract` | Envelope login berbeda dari pola `data` |
| GET | `/api/mobile/auth/me` | `src/context/AuthContext.tsx` | `app/api/mobile/auth/me/route.ts` | Bearer mobile auth | `apiSuccess(data)` | Belum terlihat route test langsung | `match` | Dipakai untuk bootstrap session |
| POST | `/api/mobile/auth/refresh` | `src/services/RefreshTokenService.ts` | Tidak terdeteksi | Refresh token flow | Client mengharap `{ token, refreshToken? }` | Tidak terdeteksi | `missing-backend` | Gap kritikal |
| GET | `/api/mobile/work-orders` | `src/hooks/queries/useWorkOrders.ts` | `app/api/mobile/work-orders/route.ts` | Auth | `apiPaginated(data, meta)` | Indirect | `match` | List active/history |
| GET/POST | `/api/mobile/work-orders/available` | `src/hooks/queries/useWorkOrders.ts` | `app/api/mobile/work-orders/available/route.ts` | Auth | `apiSuccess(...)` | Indirect | `match` | Claim/take work order |
| POST | `/api/mobile/work-orders/request` | `src/hooks/queries/useWorkOrders.ts` | `app/api/mobile/work-orders/request/route.ts` | Auth | `apiSuccess(data)` | `mobile-work-orders-request-route.test.ts` | `match` | Contract cukup rapi |
| GET | `/api/mobile/work-orders/{id}` | `src/hooks/queries/useWorkOrders.ts`, `app/(app)/complete-work-order/[id].tsx` | `app/api/mobile/work-orders/[id]/route.ts` | Auth | `apiSuccess(data)` | Indirect | `match` | Detail WO |
| POST | `/api/mobile/work-orders/{id}/update` | `app/(app)/complete-work-order/[id].tsx`, `app/(app)/work-order-detail/[id].tsx` | `app/api/mobile/work-orders/[id]/update/route.ts` | Auth | `apiSuccess/apiError` | `mobile-work-orders-update-route.test.ts` | `match` | Surface penting |
| GET/POST | `/api/mobile/work-orders/{id}/tasks` | `app/(app)/work-order-detail/[id].tsx` | `app/api/mobile/work-orders/[id]/tasks/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| GET/POST | `/api/mobile/work-orders/{id}/materials` | `app/(app)/ambil-barang/[id].tsx` | `app/api/mobile/work-orders/[id]/materials/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| POST | `/api/mobile/work-orders/{id}/return` | `app/(app)/kembalikan-barang/[id].tsx` | `app/api/mobile/work-orders/[id]/return/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| GET/POST/DELETE | `/api/mobile/work-orders/{id}/partners` | `app/(app)/work-order-detail/[id].tsx` | `app/api/mobile/work-orders/[id]/partners/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| POST | `/api/mobile/work-orders/{id}/partner-response` | `app/(app)/work-order-detail/[id].tsx` | `app/api/mobile/work-orders/[id]/partner-response/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| POST | `/api/mobile/work-orders/complete` | `src/hooks/queries/useWorkOrders.ts` | Tidak terdeteksi | Seharusnya auth | Tidak terkonfirmasi | Tidak ada | `missing-backend` | Sangat mungkin kontrak lama |
| GET | `/api/mobile/attendance/geofence` | `app/(app)/absensi.tsx` | `app/api/mobile/attendance/geofence/route.ts` → alias ke `app/api/mobile/geofence/route.ts` | Auth | `apiSuccess(data)` | `mobile-attendance-geofence-alias.test.ts` | `match` | Alias endpoint |
| POST | `/api/mobile/attendance/check-in` | `app/(app)/absensi.tsx` | `app/api/mobile/attendance/check-in/route.ts` | Auth | Envelope backend penuh | Ada indirect mobile tests | `match` | Core flow |
| POST | `/api/mobile/attendance/check-out` | `app/(app)/absensi.tsx` | `app/api/mobile/attendance/check-out/route.ts` | Auth | Envelope backend penuh | Ada indirect mobile tests | `match` | Core flow |
| GET | `/api/mobile/attendance/status` | `app/(app)/absensi.tsx` | `app/api/mobile/attendance/status/route.ts` | Auth | `apiSuccess(data)` | `mobile-attendance-status-route.test.ts`, `currentStatusContract.test.ts` | `match` | |
| GET/POST | `/api/mobile/leaves` | `app/(app)/izin/index.tsx`, `app/(app)/izin/form.tsx` | `app/api/mobile/leaves/route.ts` | Auth | `apiSuccess/apiError` | `mobile-leaves-route.test.ts` | `match` | |
| GET/POST | `/api/mobile/overtime` | `app/(app)/lembur/index.tsx` | `app/api/mobile/overtime/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| GET | `/api/mobile/holidays` | `app/(app)/holidays.tsx` | `app/api/mobile/holidays/route.ts` | Auth | `createHandler` envelope | Belum jelas | `match` | |
| GET | `/api/mobile/profile` | `app/(app)/edit-profile.tsx`, `app/(app)/izin/form.tsx`, `src/hooks/useProfileSync.ts` | `app/api/mobile/profile/route.ts` | Auth | `apiSuccess(data)` | Belum jelas | `match` | |
| POST | `/api/mobile/profile/password` | `app/(app)/change-password.tsx` | `app/api/mobile/profile/password/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| POST | `/api/mobile/profile/photo` | `app/(app)/edit-profile.tsx` | `app/api/mobile/profile/photo/route.ts` | Auth | `apiSuccess(updated)` | Belum jelas | `match` | Multipart |
| GET | `/api/mobile/dashboard` | `app/(app)/dashboard.tsx`, `src/components/screens/MitraSalesDashboardScreen.tsx`, `src/components/screens/MitraDashboardScreen.tsx`, `app/(app)/barang/index.tsx` | `app/api/mobile/dashboard/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | Banyak consumer |
| GET | `/api/mobile/notifications` | `app/(app)/notifications.tsx`, `src/components/molecules/NotificationBell.tsx` | `app/api/mobile/notifications/route.ts` | Mobile auth payload | Legacy/custom | `mobile-notifications-route.test.ts` | `match` | Tidak full `createHandler` |
| GET | `/api/mobile/announcements` | `src/components/organisms/AnnouncementPopup.tsx` | Tidak terdeteksi | Seharusnya auth | Client harap raw array | Tidak ada | `missing-backend` | Gap tinggi |
| POST | `/api/mobile/announcements/{id}/read` | `src/components/organisms/AnnouncementPopup.tsx`, `app/(app)/notifications.tsx` | `app/api/mobile/announcements/[id]/read/route.ts` | Mobile auth payload | `success + read` | Belum jelas | `match-special-contract` | Return shape beda |
| POST | `/api/mobile/fcm-token` | `src/services/FirebaseMessagingService.ts` | `app/api/mobile/fcm-token/route.ts` | Auth | `apiSuccess` | `mobile-fcm-token-route.test.ts` | `match` | |
| POST/DELETE | `/api/mobile/push-token` | Caller aktif runtime belum tampak jelas | `app/api/mobile/push-token/route.ts` | Auth | Custom | Belum jelas | `backend-exists-caller-unclear` | Kemungkinan legacy |
| GET/POST | `/api/mobile/chat/conversations` | `src/services/ChatService.ts`, `app/(app)/chat/new.tsx` | `app/api/mobile/chat/conversations/route.ts` | Auth | `response.data.data` | Belum jelas | `match` | |
| GET/POST | `/api/mobile/chat/conversations/{id}` | `src/services/ChatService.ts`, `app/(app)/chat/[conversationId].tsx` | `app/api/mobile/chat/conversations/[id]/route.ts` | Auth | `response.data.data` | Belum jelas | `match` | |
| GET | `/api/mobile/chat/global` | `src/services/ChatService.ts` | `app/api/mobile/chat/global/route.ts` | Auth | `response.data.data` | Belum jelas | `match` | |
| GET | `/api/mobile/chat/users` | `src/services/ChatService.ts` | `app/api/mobile/chat/users/route.ts` | Auth | `response.data.data` | Belum jelas | `match` | |
| POST | `/api/mobile/chat/upload` | `src/services/ChatService.ts` | `app/api/mobile/chat/upload/route.ts` | Auth | Upload response custom | Belum jelas | `match` | Multipart |
| GET | `/api/mobile/app-version/check` | `src/services/AppVersionService.ts` | `app/api/mobile/app-version/check/route.ts` | Public | Custom success envelope | Belum jelas | `match` | |
| POST | `/api/mobile/app-version/report` | `src/services/AppVersionService.ts` | `app/api/mobile/app-version/report/route.ts` | Public/Bearer optional | Custom | `mobile-app-version-report-route.test.ts` | `match` | |
| GET | `/api/mobile/app-version/download/{id}` | `src/services/AppVersionService.ts` | `app/api/mobile/app-version/download/[id]/route.ts` | Route exists | File/binary response | Belum jelas | `match` | Coverage belum tampak |
| GET | `/api/mobile/mitra/dashboard` | `src/components/screens/MitraTeknisiDashboardScreen.tsx` | `app/api/mobile/mitra/dashboard/route.ts` | Auth | `apiSuccess` | Belum jelas | `match` | |
| GET | `/api/mobile/mitra/wallet` | `app/(app)/mitra-wallet.tsx` | `app/api/mobile/mitra/wallet/route.ts` | Auth | `apiSuccess` | Belum jelas | `match` | |
| GET/POST | `/api/mobile/mitra/withdraw` | `app/(app)/mitra-withdraw.tsx` | `app/api/mobile/mitra/withdraw/route.ts` | Auth | `apiSuccess` | Belum jelas | `match` | |
| POST | `/api/mobile/mitra/verify-face` | `src/components/organisms/FaceVerificationModal.tsx` | `app/api/mobile/mitra/verify-face/route.ts` | Auth | `apiSuccess/apiError` | Belum jelas | `match` | |
| POST | `/api/mobile/mitra/fcm-token` | Caller aktif runtime belum tampak jelas | `app/api/mobile/mitra/fcm-token/route.ts` | Auth | `apiSuccess` | Belum jelas | `backend-exists-caller-unclear` | |
| GET | `/api/mobile/mixradius/customers` | `src/services/MixRadiusService.ts`, `app/(app)/request-work-order.tsx` | `app/api/mobile/mixradius/customers/route.ts` | Auth | `apiSuccess/apiError` | `mobile-mixradius-customers-route.test.ts` | `match` | |
| POST/DELETE | `/api/mobile/upload` | `src/services/UploadService.ts` | `app/api/mobile/upload/route.ts` | Auth | Upload/cleanup custom | `mobile-upload-route.test.ts` | `match` | |
| POST | `/api/mobile/location` | `src/services/LocationTrackingService.ts` | `app/api/mobile/location/route.ts` | Auth | `apiSuccess/apiError` | Client-side tests ada | `match` | |
| GET | `/api/mobile/topology` | `app/(app)/topology-map.tsx` | `app/api/mobile/topology/route.ts` | Auth + permission | `apiSuccess/apiError` | Belum jelas | `match` | |
| GET | `/api/mobile/departments` | `app/(app)/request-work-order.tsx` | `app/api/mobile/departments/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET/POST | `/api/mobile/inventory/masuk` | `app/(app)/barang/masuk.tsx` | `app/api/mobile/inventory/masuk/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET/POST | `/api/mobile/inventory/keluar` | `app/(app)/barang/keluar.tsx` | `app/api/mobile/inventory/keluar/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET | `/api/mobile/inventory/gudang` | `app/(app)/barang/keluar.tsx`, `app/(app)/barang/masuk.tsx`, `app/(app)/ambil-barang/[id].tsx`, `app/(app)/kembalikan-barang/[id].tsx` | `app/api/mobile/inventory/gudang/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET | `/api/mobile/inventory/barang` | `app/(app)/barang/keluar.tsx`, `app/(app)/barang/masuk.tsx`, `app/(app)/ambil-barang/[id].tsx`, `app/(app)/kembalikan-barang/[id].tsx` | `app/api/mobile/inventory/barang/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET | `/api/mobile/inventory/riwayat` | `app/(app)/barang/riwayat.tsx` | `app/api/mobile/inventory/riwayat/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET | `/api/mobile/partners` | `app/(app)/work-order-detail/[id].tsx` | `app/api/mobile/partners/route.ts` | Auth | Custom success/error | Belum jelas | `match` | |
| GET | `/api/mobile/salary` | Caller aktif tidak terdeteksi | `app/api/mobile/salary/route.ts` | Auth + permission | `apiSuccess` | Belum jelas | `backend-exists-caller-unclear` | |
| GET | `/api/mobile/salary/{id}` | Caller aktif tidak terdeteksi | `app/api/mobile/salary/[id]/route.ts` | Auth + permission | `apiError/success` | Belum jelas | `backend-exists-caller-unclear` | |
| POST | `/api/mobile/error-report` | `src/services/ErrorReportingService.ts` | `app/api/mobile/error-report/route.ts` | Custom/public-ish | Custom | `mobile-error-report-route.test.ts` | `match` | |
| GET | `/api/mobile/ping` | Caller aktif tidak terdeteksi | `app/api/mobile/ping/route.ts` | Public | `apiSuccess` | Tidak relevan | `backend-exists-caller-unclear` | |

## 6) Source of Truth Matrix — Endpoint non-`/api/mobile/*` yang dipakai mobile

| Method | Path | Caller mobile | Backend route | Auth | Coverage | Status | Catatan |
|---|---|---|---|---|---|---|---|
| GET | `/api/customer/profile` | `app/(customer)/dashboard.tsx`, `app/(customer)/paket/index.tsx` | `app/api/customer/profile/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET | `/api/customer/usage` | `app/(customer)/dashboard.tsx`, `app/(customer)/koneksi/index.tsx` | `app/api/customer/usage/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET | `/api/customer/invoices` | `app/(customer)/dashboard.tsx`, `app/(customer)/tagihan/index.tsx`, `app/(customer)/riwayat/index.tsx` | `app/api/customer/invoices/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET | `/api/customer/payment-methods` | `app/(customer)/tagihan/index.tsx` | `app/api/customer/payment-methods/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET | `/api/customer/payments/sse` | `app/(customer)/tagihan/index.tsx` | `app/api/customer/payments/sse/route.ts` | Customer auth | Belum diaudit khusus | `match` | SSE |
| POST | `/api/customer/payments/upload-receipt` | `app/(customer)/tagihan/index.tsx` | `app/api/customer/payments/upload-receipt/route.ts` | Customer auth | Belum diaudit khusus | `match` | Multipart |
| POST | `/api/customer/payments` | `app/(customer)/tagihan/index.tsx` | `app/api/customer/payments/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET/POST | `/api/customer/tickets` | `app/(customer)/tickets/index.tsx` | `app/api/customer/tickets/route.ts` | Customer auth | Belum diaudit khusus | `match` | |
| GET | `/api/marketing/canvasing/summary` | `app/(app)/dashboard.tsx`, `src/components/screens/MitraDashboardScreen.tsx` | `app/api/marketing/canvasing/summary/route.ts` | Auth + RBAC | Belum diaudit khusus | `match` | |
| POST | `/api/marketing/claims/cashout` | `app/(app)/dashboard.tsx` | `app/api/marketing/claims/cashout/route.ts` | Auth + sales check | Belum diaudit khusus | `match` | |
| GET | `/api/marketing/point-claims/summary` | `app/(app)/marketing/canvasing/index.tsx` | `app/api/marketing/point-claims/summary/route.ts` | Auth | Belum diaudit khusus | `match` | |
| GET/POST | `/api/marketing/canvasing` | `app/(app)/marketing/canvasing/index.tsx`, `app/(app)/marketing/canvasing/create.tsx` | `app/api/marketing/canvasing/route.ts` | Auth + RBAC | Belum diaudit khusus | `match` | |
| GET | `/api/marketing/canvasing/{id}` | `app/(app)/marketing/canvasing/[id]/index.tsx` | `app/api/marketing/canvasing/[id]/route.ts` | Auth | Belum diaudit khusus | `match` | |
| POST | `/api/marketing/canvasing/{id}/claim` | `app/(app)/marketing/canvasing/[id]/index.tsx`, `app/(app)/marketing/canvasing/[id]/claim.tsx` | `app/api/marketing/canvasing/[id]/claim/route.ts` | Auth | Belum diaudit khusus | `match` | |
| GET | `/api/integrations/mixradius/customers/{id}` | `src/services/MixRadiusService.ts` | `app/api/integrations/mixradius/customers/[id]/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| GET | `/api/integrations/mixradius/owners` | `src/services/MixRadiusService.ts` | `app/api/integrations/mixradius/owners/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| GET | `/api/integrations/mixradius/groups` | `src/services/MixRadiusService.ts` | `app/api/integrations/mixradius/groups/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| POST | `/api/integrations/mixradius/dismantle` | `src/services/MixRadiusService.ts` | `app/api/integrations/mixradius/dismantle/route.ts` | Auth + permission | Belum diaudit khusus | `match` | Dipakai mobile walau bukan `/mobile/*` |
| GET/POST | `/api/map/nodes` | `src/components/organisms/topology/DeviceCreateModal.tsx` | `app/api/map/nodes/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| POST | `/api/map/edges` | `src/components/organisms/topology/DeviceCreateModal.tsx` | `app/api/map/edges/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| DELETE | `/api/map/edges/{edgeId}` | `app/(app)/topology-map.tsx` | `app/api/map/edges/[edgeId]/route.ts` | Auth + permission | Belum diaudit khusus | `match` | |
| POST | `/api/coupons/verify` | `app/(customer)/tagihan/index.tsx` | `app/api/coupons/verify/route.ts` | `auth: false` | Belum diaudit khusus | `security-review` | Endpoint publik, perlu audit otorisasi lebih dalam |

## 7) Coverage Snapshot

### Area yang tampak sudah cukup ter-cover
- attendance
  - `mobile-attendance-status-route.test.ts`
  - `mobile-attendance-route-parity.test.ts`
  - `mobile-attendance-geofence-alias.test.ts`
- work order
  - `mobile-work-orders-request-route.test.ts`
  - `mobile-work-orders-request-bearer-siteid.test.ts`
  - `mobile-work-orders-update-route.test.ts`
- notifications
  - `mobile-notifications-route.test.ts`
- upload
  - `mobile-upload-route.test.ts`
- FCM token
  - `mobile-fcm-token-route.test.ts`
- MixRadius mobile customer search
  - `mobile-mixradius-customers-route.test.ts`
- error report
  - `mobile-error-report-route.test.ts`
- app version report
  - `mobile-app-version-report-route.test.ts`
- mobile client auth/interceptor/session
  - `mobile-netmanager/__tests__/services/api.test.ts`
  - `mobile-netmanager/__tests__/context/AuthContext.test.tsx`

### Area yang tampak masih lemah / belum jelas
- `/api/mobile/auth/login`
- `/api/mobile/auth/me`
- `/api/mobile/auth/refresh`
- profile endpoints
- chat endpoints
- mitra endpoints
- inventory endpoints
- app-version check/download
- announcements listing
- endpoint non-mobile yang dipakai mobile, terutama:
  - `/api/coupons/verify`
  - `/api/integrations/mixradius/dismantle`

## 8) Prioritas Remediation

### P0
1. Verifikasi dan perbaiki contract/backend untuk `/api/mobile/auth/refresh`.
2. Hapus atau migrasikan caller `/api/mobile/work-orders/complete`.
3. Verifikasi dan implementasikan source of truth untuk `GET /api/mobile/announcements`.
4. Normalisasi kontrak response untuk endpoint yang punya special-case tinggi (`auth/login`, `announcements/*`).

### P1
5. Tambahkan route tests untuk auth mobile (`login`, `me`, `refresh`).
6. Tambahkan coverage untuk profile, chat, mitra, inventory, app-version check/download.
7. Audit `hybrid-auth.ts` vs `createHandler` agar enforcement auth mobile konsisten.

### P2
8. Dokumentasikan endpoint mobile lintas surface sebagai referensi tim.
9. Standarkan endpoint lama/custom ke helper `apiSuccess` / `apiError` bila aman dilakukan.

## 9) Keputusan Audit

1. Scope resmi mobile API audit harus selalu mencakup **semua endpoint yang dipakai mobile**, bukan hanya `/api/mobile/*`.
2. `mobile-netmanager` saat ini masih memiliki dependency terhadap beberapa kontrak lama atau non-canonical.
3. Perubahan remediation berikutnya harus dimulai dari gap P0 sebelum refactor kosmetik atau standardisasi massal.

## 10) Next Actions yang Direkomendasikan

Urutan implementasi yang paling aman:
1. Audit dan pastikan provider untuk `auth/refresh`.
2. Audit dan putuskan canonical flow untuk work-order complete.
3. Audit dan putuskan canonical flow untuk announcement listing.
4. Tambahkan test untuk auth mobile dan response contract yang paling kritis.
5. Baru lakukan penyelarasan response envelope dan cleanup caller lama.