# Audit Sistem Kehadiran Lintas Surface

> **Tanggal Audit:** 2026-03-30  
> **Ruang Lingkup:** Portal admin, backend attendance, worker web attendance, mobile app, offline sync, geofence, reporting, dan automation/cron  
> **Metode:** code inspection, cross-surface flow tracing, historical audit review, test coverage review, dan external best-practice comparison  
> **Status:** Audit saat ini berbasis implementasi yang ada di repository, bukan asumsi dari dokumen lama

---

## 1. Ringkasan Eksekutif

Audit ini menunjukkan bahwa sistem kehadiran sudah memiliki fondasi yang cukup kuat: backend memiliki service terpusat, mobile sudah memakai idempotency + offline queue, dan admin portal sudah terpisah cukup jelas antara list raw attendance, report agregat, dan live tracking. Namun, risiko terbesar saat ini **bukan crash**, melainkan **drift makna bisnis** antara satu event kehadiran yang sama dengan bagaimana event itu diinterpretasikan di mobile, worker web, backend, cron, admin report, dan export CSV.

### Kesimpulan Utama

1. **Kritis — Cross-surface semantic drift**  
   Satu event attendance berpotensi menghasilkan status, warning, atau label yang berbeda antara mobile app, worker web, admin list/export, dan admin report.

2. **Kritis — Dua engine stale-session / auto-checkout**  
   Logika penutupan sesi lama tersebar di `AttendanceService.processAutoCheckout()` dan `AutoCheckoutService.runAutoCheckout()` dengan aturan yang tidak sepenuhnya identik.

3. **Tinggi — Offline sync bisa terlihat “selesai”, padahal event akhir belum tervalidasi lintas surface**  
   Mobile queue memperlakukan `400/404/409/422` sebagai terminal failure. Jika conflict atau validasi backend tidak dipetakan tepat, antrean bisa dibersihkan tanpa jaminan state akhir benar-benar sesuai harapan user.

4. **Tinggi — Enforcement geofence dan bukti kehadiran masih permisif pada beberapa kondisi**  
   Jika site/koordinat tidak tersedia atau koordinat tidak dikirim, sistem cenderung fall back ke acceptance yang lebih longgar.

5. **Tinggi — Admin report adalah hasil derivasi, bukan cerminan langsung raw event**  
   Karena report melakukan agregasi/skoring/relabelling, angka admin dapat menyimpang dari pemahaman user di mobile atau dari row attendance mentah.

---

## 2. Scope dan Out-of-Scope

### 2.1 In Scope

- Flow check-in/check-out pada mobile app.
- Flow status attendance pada mobile app dan worker web.
- Backend mutation, idempotency, geofence validation, timezone, dan stale-session handling.
- Admin list/export, admin report/dashboard, dan admin live tracking yang terkait attendance.
- Cron/automation yang memengaruhi state attendance (`auto-checkout`, `attendance`, `process-absence`, `attendance-alert`).
- Test coverage yang relevan dan audit historis yang masih memiliki pengaruh terhadap keputusan saat ini.

### 2.2 Out of Scope

- Audit infrastruktur deployment/hosting.
- Penetration test keamanan jaringan.
- Review UI/UX visual secara detail di luar dampaknya ke integritas attendance.
- Verifikasi data production nyata di database live.
- Evaluasi legal final oleh tim compliance/lawyer.

---

## 3. Metodologi Audit

Audit dilakukan dengan menelusuri satu lifecycle event kehadiran secara end-to-end:

1. **Capture / submit di mobile** — geofence, location, foto, request ID, offline queue.
2. **Penerimaan di backend** — auth, signature, idempotency, geofence validation, timezone, duplicate prevention.
3. **Mutation lanjutan oleh sistem** — auto-checkout, cron, process-absence, alert/reminder.
4. **Pembacaan status** — mobile history/status, worker web status, analytics, admin list, admin report, CSV export.
5. **Evidence & controls** — test coverage, telemetry, audit lama, dan external best practices.

Audit ini juga memverifikasi klaim dari dokumen audit lama terhadap implementasi repository saat ini untuk membedakan **temuan yang masih aktif** vs **temuan yang sudah tidak berlaku**.

---

## 4. Severity Rubric / Model Risiko

### Kritis

- Berpotensi menciptakan **dua kebenaran bisnis** untuk event attendance yang sama.
- Dapat mengubah keputusan operasional/payroll/supervisi secara material.
- Sulit dideteksi user biasa karena sistem tetap terlihat “jalan”.

### Tinggi

- Tidak selalu menghasilkan mismatch langsung, tetapi sangat mungkin menimbulkan kehilangan kepercayaan data, weak evidence, atau bias report.
- Perlu tindakan engineering dalam horizon dekat.

### Menengah

- Risiko nyata namun terbatas pada edge case, path sekunder, atau governance concern yang tidak selalu aktif pada flow utama.
- Tetap perlu ditangani agar tidak berkembang menjadi isu struktural.

---

## 5. Peta Arsitektur Singkat

### 5.1 Backend / Web (`netmanager`)

- **Mobile attendance APIs**
  - `app/api/mobile/attendance/check-in/route.ts`
  - `app/api/mobile/attendance/check-out/route.ts`
  - `app/api/mobile/attendance/history/route.ts`
  - `app/api/mobile/geofence/route.ts`
- **Worker/web attendance APIs**
  - `app/api/attendance/history/route.ts`
  - `app/api/attendance/analytics/route.ts`
- **Admin APIs**
  - `app/api/admin/attendance/route.ts`
  - `app/api/admin/reports/presence/route.ts`
  - `app/api/admin/location/live/route.ts`
- **Cron / automation**
  - `app/api/cron/auto-checkout/route.ts`
  - `app/api/cron/attendance/route.ts`
  - `app/api/cron/process-absence/route.ts`
  - `app/api/cron/attendance-alert/route.ts`
- **Core services**
  - `modules/attendance/services/AttendanceService.ts`
  - `AutoCheckoutService.ts`
  - `AttendanceIdempotencyService.ts`
  - `AttendanceValidationService.ts`
  - `AttendanceTimezoneService.ts`
  - `GeofenceService.ts`
  - `LocationTrackingService.ts`

### 5.2 Mobile (`mobile-netmanager`)

- `app/(app)/absensi.tsx` — orchestration utama check-in/check-out.
- `src/hooks/queries/useApiMutation.ts` — request wrapper + queue-aware mutation.
- `src/services/SyncService.ts` — replay antrean offline.
- `src/services/LocationTrackingService.ts` — live/pending location sync.
- `src/utils/attendanceIdempotency.ts` — request ID + idempotency header.
- `src/utils/attendanceStatus.ts` — derivasi status UI dari latest history record.
- `src/utils/attendanceGeofencePolicy.ts` — mapping `STRICT/WARN/DISABLED` -> `block/warn/allow`.
- `src/components/organisms/FaceVerificationModal.tsx` — flow verifikasi wajah terpisah dari submit attendance utama.

### 5.3 Surface Pengguna / Admin

- **Mobile app**: status harian, geofence warning, offline queue, location tracking.
- **Worker web**: `components/attendance/AttendancePageContent.tsx` + `AttendanceAnalytics.tsx`.
- **Admin list/export**: `app/api/admin/attendance/route.ts`.
- **Admin report/dashboard**: `app/admin/kehadiran/laporan/ReportClient.tsx` + `app/api/admin/reports/presence/route.ts`.
- **Admin live map**: `app/admin/kehadiran/live-map/*` + `app/api/admin/location/live/route.ts`.

---

## 6. Temuan Utama

## 6.1 KRITIS — Drift Makna Status dan Hasil Akhir Antar Surface

### Masalah

Sistem tidak memiliki satu surface status tunggal yang menjadi sumber kebenaran untuk semua UX. Sebaliknya, beberapa surface menghitung/menginterpretasikan status sendiri:

- **Mobile** mengambil `history?limit=1` lalu menghitung UI via `deriveAttendanceStatus(...)`.
- **Worker web** di `AttendancePageContent.tsx` memakai logika sederhana berbasis same-day record.
- **Admin list/export** memakai raw attendance rows, lalu **relabel** status saat export CSV.
- **Admin report** memakai `AttendanceService.getReportData(...)`, yang membangun agregasi dan skor turunan.

### Dampak

- User mobile bisa melihat `checked-in` atau `idle`, sementara worker web melihat hasil berbeda.
- Admin CSV/export dapat menampilkan label yang berbeda dari status mentah yang tersimpan.
- Supervisor/admin bisa mengambil keputusan dari angka/label yang tidak identik dengan pengalaman user di app.

### Evidence

- `mobile-netmanager/src/utils/attendanceStatus.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`
- `netmanager/components/attendance/AttendancePageContent.tsx`
- `netmanager/app/api/admin/attendance/route.ts`
- `netmanager/app/api/admin/reports/presence/route.ts`
- `netmanager/modules/attendance/services/AttendanceService.ts`

### Surface Terdampak

- Mobile app
- Worker web
- Admin list/export
- Admin report/dashboard

### Tingkat Keyakinan

Tinggi — divergensi logika terlihat langsung pada kode pembacaan/derivasi state di masing-masing surface.

### Rekomendasi

1. Definisikan **canonical attendance state contract** lintas surface.
2. Tambahkan test matrix yang membandingkan hasil untuk event yang sama di mobile, worker web, admin list, report, dan export.
3. Pisahkan dengan jelas mana yang **raw state**, mana yang **derived label**, dan mana yang **business interpretation**.

---

## 6.2 KRITIS — Dua Engine Penutupan Sesi Lama / Auto-Checkout

### Masalah

Penutupan sesi lama ditangani oleh dua jalur berbeda:

1. `AttendanceService.processAutoCheckout()` — dipanggil inline saat check-in baru.
2. `AutoCheckoutService.runAutoCheckout()` — dipanggil via cron endpoint.

Keduanya punya aturan berbeda untuk FLEXIBLE, overnight shift, timestamp checkout, dan status hasil akhir.

### Dampak

- Sesi lama bisa ditutup dengan hasil berbeda tergantung jalur mana yang lebih dulu aktif.
- Overnight shift dan flexible session menjadi area paling rawan mismatch.
- Sulit menjelaskan ke user/admin kenapa sebuah row berubah menjadi `NO_CHECKOUT`, warning, atau tetap aktif/stale.

### Evidence

- `netmanager/modules/attendance/services/AttendanceService.ts`
- `netmanager/modules/attendance/services/AutoCheckoutService.ts`
- `netmanager/app/api/cron/auto-checkout/route.ts`
- `netmanager/app/api/mobile/attendance/history/route.ts`

### Surface Terdampak

- Backend mutation path
- Cron automation
- Mobile status/warning
- Admin review terhadap row attendance

### Tingkat Keyakinan

Tinggi — dua jalur policy ditemukan langsung pada implementasi service yang berbeda.

### Rekomendasi

1. Satukan policy stale-session/auto-checkout dalam satu source of truth.
2. Tambahkan integration test untuk:
   - fixed schedule + no checkout
   - flexible session >24 jam
   - overnight shift sebelum dan sesudah batas shift berakhir
3. Pastikan mobile stale-session warning menggunakan policy yang sama dengan backend automation.

---

## 6.3 TINGGI — Risiko Silent Mismatch pada Offline Queue dan Replay

### Masalah

Mobile sudah punya offline queue yang rapi, namun ada dua risiko utama:

1. Backend menerima `offlineTime` sebagai bagian dari mutation path.
2. `SyncService` menganggap `400/404/409/422` sebagai **terminal failure** dan membersihkan item antrean.

Secara khusus, untuk attendance replay, `409` diperlakukan sebagai conflict/duplicate terminal. Ini aman **jika** backend memang sudah menyimpan hasil akhir yang benar. Jika tidak, event bisa hilang dari queue tanpa rekonsiliasi memadai.

### Dampak

- User merasa absensi “sudah terkirim”, tetapi data akhir di backend/admin belum tentu sesuai.
- Event replay yang gagal validasi dapat hilang dari antrean tanpa workflow manual recovery.
- Trust ke offline attendance menurun saat koneksi buruk atau ada retry berulang.

### Evidence

- `mobile-netmanager/src/services/SyncService.ts`
- `mobile-netmanager/src/utils/attendanceIdempotency.ts`
- `netmanager/app/api/mobile/attendance/check-in/route.ts`
- `netmanager/app/api/mobile/attendance/check-out/route.ts`
- `netmanager/modules/attendance/services/AttendanceIdempotencyService.ts`
- `netmanager/tests/modules/attendance/AttendanceIdempotencyService.test.ts`

### Surface Terdampak

- Mobile submit
- Offline replay engine
- Backend attendance write path
- Admin observability/reconciliation

### Tingkat Keyakinan

Menengah-Tinggi — mekanisme terminal failure dan trust terhadap `offlineTime` terlihat jelas, tetapi besaran mismatch aktual tetap perlu dibuktikan dengan invariant/integration test.

### Rekomendasi

1. Tambahkan invariant test: setiap replay `409` harus bisa dibuktikan punya row akhir yang sesuai.
2. Tambahkan audit log/correlation ID dari request ID mobile sampai row attendance final.
3. Sediakan admin/backoffice reconciliation view untuk attendance event yang gagal replay atau conflict.

---

## 6.4 TINGGI — Enforcement Geofence dan Bukti Kehadiran Masih Permisif pada Kondisi Tertentu

### Masalah

Logika geofence di backend cukup konsisten terhadap policy `STRICT/WARN/DISABLED`, tetapi enforcement tetap longgar jika:

- koordinat tidak dikirim,
- user tidak punya site,
- site tidak punya koordinat,
- site tidak aktif.

Selain itu, mobile memang sengaja mengizinkan flow `WARN` untuk lanjut setelah konfirmasi user. Dari sisi produk ini sah, tetapi dari sisi audit berarti perlu dibedakan antara **attendance valid** dan **attendance dengan bukti lokasi lemah**.

### Dampak

- Attendance dapat diterima tanpa evidence lokasi yang cukup kuat.
- Sengketa lokasi akan sulit dibuktikan jika geofence fallback terlalu permisif.
- Admin mungkin melihat attendance “sah” tanpa tahu kualitas evidence-nya.

### Evidence

- `netmanager/modules/attendance/services/GeofenceService.ts`
- `netmanager/tests/modules/attendance/GeofenceService.test.ts`
- `netmanager/app/api/mobile/geofence/route.ts`
- `mobile-netmanager/src/utils/attendanceGeofencePolicy.ts`
- `mobile-netmanager/__tests__/services/attendanceGeofencePolicy.test.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`

### Surface Terdampak

- Mobile geofence UX
- Backend check-in/check-out validation
- Admin interpretasi bukti kehadiran

### Tingkat Keyakinan

Tinggi — permissive fallback dan policy mapping terbukti pada service/test/client flow.

### Rekomendasi

1. Tambahkan klasifikasi evidence di row attendance / admin UI: `strong`, `warn`, `missing-coordinates`, `site-config-missing`, dst.
2. Audit konfigurasi site yang tidak punya koordinat/radius.
3. Pisahkan dashboard “valid attendance” dari “attendance accepted with weak geofence evidence”.

---

## 6.5 TINGGI — Admin Report dan Export Adalah Hasil Derivasi, Bukan Cerminan Langsung Raw Event

### Masalah

Ada dua jalur admin yang berbeda:

- **Admin list/export** memakai raw attendance rows dengan filter timezone-aware dan relabel khusus saat export.
- **Admin report** memakai `getReportData(...)` yang melakukan agregasi attendance/overtime/absence/late/leave, lalu menghitung skor dan summary turunan.

Selain itu, `getReportData(...)` menginisialisasi user summary dari user yang punya attendance days, sehingga ada risiko underrepresentation untuk user yang hanya muncul lewat absence/overtime path tertentu.

### Dampak

- CSV export dan dashboard report bisa menampilkan narasi bisnis berbeda untuk populasi user yang sama.
- Penghitungan star employee / top absentee / summary per user dapat bias terhadap user yang memang punya attendance rows.
- Admin bisa salah membaca angka karena tidak jelas mana yang raw vs derived.

### Evidence

- `netmanager/app/api/admin/attendance/route.ts`
- `netmanager/app/admin/kehadiran/laporan/ReportClient.tsx`
- `netmanager/app/api/admin/reports/presence/route.ts`
- `netmanager/modules/attendance/services/AttendanceService.ts`

### Surface Terdampak

- Admin dashboard
- Admin export CSV
- Pengambilan keputusan supervisor/HR

### Tingkat Keyakinan

Menengah-Tinggi — perbedaan jalur data terlihat langsung, tetapi severity bisnis final tergantung penggunaan report/export untuk proses operasional nyata.

### Rekomendasi

1. Dokumentasikan kontrak bisnis report secara eksplisit.
2. Tambahkan snapshot/invariant test untuk report vs export vs raw rows pada dataset yang sama.
3. Review apakah user tanpa attendance rows tetap harus muncul pada summary tertentu.

---

## 6.6 MENENGAH — Mobile dan Worker Web Tidak Berbagi Status Endpoint yang Sama

### Masalah

Mobile memakai latest history record + derivation utility yang cukup kaya (overnight, flexible, stale session), sedangkan worker web terlihat memakai interpretasi lebih sederhana berbasis same-day.

### Dampak

- User yang sama bisa melihat status berbeda di mobile dan web.
- Bug status cenderung sulit direproduksi karena tiap surface punya aturan sendiri.

### Evidence

- `mobile-netmanager/src/utils/attendanceStatus.ts`
- `mobile-netmanager/__tests__/utils/attendanceStatus.test.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`
- `netmanager/components/attendance/AttendancePageContent.tsx`

### Surface Terdampak

- Mobile app
- Worker web

### Tingkat Keyakinan

Tinggi — perbedaan model pembacaan status terlihat langsung pada utility dan komponen UI.

### Rekomendasi

1. Buat satu contract/status endpoint untuk current attendance state.
2. Gunakan satu state model yang sama untuk mobile dan worker web.

---

## 6.7 MENENGAH — Inkonsistensi Path Multipart Checkout untuk Offline Metadata

### Masalah

Route mobile check-in menangani signed offline metadata pada JSON dan multipart. Namun pada check-out, path multipart tidak memproses/verifikasi `_offline_meta` dengan simetris.

### Dampak

- Backend contract tidak konsisten.
- Risiko bug laten jika ada client lain yang menggunakan multipart attendance checkout di masa depan.

### Catatan Penting

Audit terhadap mobile app saat ini menunjukkan bahwa **flow attendance utama mengirim JSON**, bukan multipart. Jadi ini **bukan risiko aktif utama untuk mobile app saat ini**, tetapi tetap merupakan inkonsistensi backend yang perlu dirapikan.

### Evidence

- `netmanager/app/api/mobile/attendance/check-in/route.ts`
- `netmanager/app/api/mobile/attendance/check-out/route.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`
- `mobile-netmanager/src/hooks/queries/useApiMutation.ts`

### Surface Terdampak

- Backend mobile checkout route
- Client/consumer non-utama yang mungkin memakai multipart

### Tingkat Keyakinan

Tinggi untuk inkonsistensi route, rendah-menengah untuk dampak aktual pada mobile app saat ini karena flow utama memakai JSON.

### Rekomendasi

1. Samakan kontrak offline metadata antara check-in dan check-out.
2. Tambahkan route-level tests untuk JSON vs multipart parity.

---

## 6.8 MENENGAH — Risiko Privasi/Compliance pada Face Verification dan Telemetry Lokasi Presisi

### Masalah

Mobile app memiliki flow `FaceVerificationModal.tsx` terpisah dari submit attendance utama, serta attendance telemetry dan location tracking yang berjalan sebagai infrastruktur app-level. Ini menambah kewajiban governance terhadap biometrik, lokasi presisi, retensi data, dan data minimization.

### Dampak

- Risiko compliance/legal meningkat, terutama bila verifikasi wajah dijadikan syarat kerja/attendance.
- Risiko over-collection untuk lokasi dan artifacts attendance.

### Evidence

- `mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx`
- `mobile-netmanager/app/_layout.tsx`
- `mobile-netmanager/src/services/AttendanceTelemetryService.ts`
- `mobile-netmanager/src/services/LocationTrackingService.ts`

### Surface Terdampak

- Mobile capture/verification
- Telemetry pipeline
- Governance/admin access model

### Tingkat Keyakinan

Menengah — kebutuhan governance jelas, namun penilaian compliance final membutuhkan kebijakan retensi, akses, dan dasar hukum di luar repository.

### Rekomendasi

1. Audit retensi, akses, masking, dan lawful basis untuk biometrik/lokasi.
2. Pastikan admin/supervisor tidak menerima data lebih detail dari yang dibutuhkan operasional.
3. Dokumentasikan lifecycle data untuk foto wajah, lokasi, dan telemetry.

---

## 7. Temuan yang Sudah Tidak Berlaku dari Audit Lama

Beberapa audit lama masih berguna sebagai sumber hipotesis, tetapi tidak semuanya cocok dengan implementasi saat ini.

### 7.1 Klaim tenant leak pada mobile attendance history perlu dianggap superseded

Audit lama `docs/audits/mobile-api-audit-report.md` menyoroti banyak route mobile yang hanya memfilter `userId`. Untuk path yang diaudit saat ini, `app/api/mobile/attendance/history/route.ts` **sudah** memakai `where: { userId, tenantId }`.

### 7.2 Klaim “semua rekomendasi attendance audit sudah selesai” tidak bisa diterima mentah

Dokumen arsip yang menyatakan semua rekomendasi telah diimplementasikan tidak dapat dijadikan bukti final tanpa verifikasi repository saat ini. Beberapa area memang sudah rapi, tetapi drift cross-surface dan duplikasi policy masih nyata.

---

## 8. Coverage Test Saat Ini

### Sudah Cukup Baik

- Geofence service dan policy client.
- Attendance idempotency service.
- Mobile attendance status derivation untuk overnight/flexible/stale session.
- Sebagian cron/auth tests.

### Masih Lemah / Belum Terlihat Kuat

- Integration test lintas surface untuk satu event yang sama.
- Report correctness vs raw attendance rows.
- Replay conflict (`409`) -> verifikasi row akhir.
- Kesetaraan policy antara inline auto-checkout vs cron auto-checkout.
- Route parity antara JSON vs multipart untuk attendance mobile.

---

## 9. Prioritas Tindak Lanjut (0–30 Hari)

## Prioritas 0 — Wajib lebih dulu

1. **Buat attendance invariant matrix**
   - Satu dataset/event diuji terhadap mobile status, worker web status, admin list, admin report, dan CSV export.
2. **Satukan policy stale-session / auto-checkout**
   - Jadikan satu engine/policy source of truth.
3. **Tambah correlation ID lintas replay**
   - Request ID mobile -> backend mutation -> row attendance -> admin/report/log.

## Prioritas 1 — Sangat disarankan

4. **Tambahkan visibility untuk weak geofence evidence**.
5. **Audit report seeding logic** untuk user tanpa attendance rows.
6. **Samakan route contract check-in/check-out** untuk offline metadata.

## Prioritas 2 — Governance / operasional

7. **Review privacy/compliance** untuk face verification + precise location telemetry.
8. **Tambahkan reconciliation workflow** untuk queue conflict/failure cases.

---

## 10. Prioritas 30–90 Hari (Perbaikan Struktural)

1. **Bangun canonical status service/endpoint** untuk dipakai mobile dan worker web.
2. **Pisahkan raw attendance, derived label, dan report semantics** agar admin tidak membaca angka turunan seolah raw event.
3. **Refactor report pipeline** dengan dataset uji tetap untuk memastikan agregasi attendance/overtime/absence konsisten lintas release.
4. **Tambahkan observability standar** untuk correlation ID, replay conflict, geofence evidence quality, dan stale-session mutation trail.
5. **Tentukan keputusan produk/security** untuk batas minimum evidence attendance: apakah koordinat kosong atau site tanpa geofence tetap dianggap valid penuh atau harus diberi label risiko.

---

## 11. File Bukti Kunci

### Backend / Admin

- `netmanager/modules/attendance/services/AttendanceService.ts`
- `netmanager/modules/attendance/services/AutoCheckoutService.ts`
- `netmanager/modules/attendance/services/GeofenceService.ts`
- `netmanager/modules/attendance/services/AttendanceIdempotencyService.ts`
- `netmanager/app/api/mobile/attendance/check-in/route.ts`
- `netmanager/app/api/mobile/attendance/check-out/route.ts`
- `netmanager/app/api/mobile/attendance/history/route.ts`
- `netmanager/app/api/mobile/geofence/route.ts`
- `netmanager/app/api/admin/attendance/route.ts`
- `netmanager/app/api/admin/reports/presence/route.ts`
- `netmanager/app/api/admin/location/live/route.ts`
- `netmanager/app/api/cron/auto-checkout/route.ts`

### Mobile

- `mobile-netmanager/app/(app)/absensi.tsx`
- `mobile-netmanager/app/_layout.tsx`
- `mobile-netmanager/src/hooks/queries/useApiMutation.ts`
- `mobile-netmanager/src/services/SyncService.ts`
- `mobile-netmanager/src/services/LocationTrackingService.ts`
- `mobile-netmanager/src/utils/attendanceIdempotency.ts`
- `mobile-netmanager/src/utils/attendanceStatus.ts`
- `mobile-netmanager/src/utils/attendanceGeofencePolicy.ts`
- `mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx`

### Tests / Historical Context

- `netmanager/tests/modules/attendance/AttendanceService.test.ts`
- `netmanager/tests/modules/attendance/AttendanceIdempotencyService.test.ts`
- `netmanager/tests/modules/attendance/GeofenceService.test.ts`
- `mobile-netmanager/__tests__/utils/attendanceStatus.test.ts`
- `mobile-netmanager/__tests__/services/SyncService.test.ts`
- `mobile-netmanager/__tests__/services/attendanceGeofencePolicy.test.ts`
- `netmanager/docs/audits/mobile-api-audit-report.md`
- `netmanager/docs/archive/attendance-audits/ATTENDANCE_SYSTEM_AUDIT_REPORT.md`

---

## 12. Penutup

Secara arsitektur, sistem kehadiran ini **bukan dalam kondisi kacau**; justru banyak fondasinya sudah baik. Masalah utamanya adalah **banyak interpretasi bisnis hidup berdampingan** di atas event attendance yang sama. Jika tidak dikonsolidasikan, masalah yang muncul akan terus berupa mismatch yang sulit dijelaskan: user merasa benar, admin merasa benar, backend juga merasa benar — tetapi semua melihat versi state yang berbeda.

Fokus perbaikan terbaik bukan menambah fitur baru lebih dulu, melainkan **menyatukan kontrak state dan bukti** lintas mobile, backend, dan admin.
