# Attendance Data Governance Follow-up

> **Tanggal:** 2026-03-30  
> **Cakupan:** face verification, precise location tracking, attendance telemetry, attendance photo upload  
> **Tujuan:** mendokumentasikan alur data aktual saat ini dan keputusan governance yang masih perlu diputuskan

---

## 1. Ringkasan Singkat

Perbaikan teknis untuk sistem kehadiran sudah berjalan, tetapi ada satu area yang belum boleh dibiarkan implisit: **governance data** untuk selfie verification, lokasi presisi, telemetry attendance, dan foto absensi.

Codebase saat ini sudah cukup jelas soal **bagaimana** data dikumpulkan dan dikirim, tetapi belum cukup eksplisit soal:

- berapa lama data disimpan,
- siapa yang boleh mengakses,
- mana data yang operasional vs sensitif,
- kapan data harus dihapus atau dipseudonimkan,
- dan log/telemetry mana yang boleh masuk ke pipeline observability jangka panjang.

Dokumen ini bukan kebijakan final. Ini adalah **follow-up teknis** supaya tim produk, engineering, dan compliance punya peta keputusan yang harus dibuat.

---

## 2. Data Flow Aktual yang Terlihat di Kode

## 2.1 Face Verification

### Client

File utama:

- `mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx`

Perilaku saat ini:

- Mengambil selfie via `expo-camera`.
- Mengirim file multipart ke `POST /api/mobile/mitra/verify-face`.
- Setelah sukses:
  - mengubah cache profile lokal,
  - mengubah `requiresFaceVerification` menjadi `false`,
  - mengupdate `image` / `fotoDiri` pada state user di mobile.

### Server

File utama:

- `netmanager/app/api/mobile/mitra/verify-face/route.ts`

Perilaku saat ini:

- Memvalidasi auth mobile untuk role `MITRA`.
- Menyimpan file ke disk lokal server di `public/uploads/mitra`.
- Menyimpan URL file ke `mitra.fotoDiri`.
- Mengubah `requiresFaceVerification=false` dan mengisi `lastFaceVerification`.
- Mencatat `faceVerificationLog.create({ mitraId, photoUrl })`.
- Menulis system activity log via `logActivitySafe(...)`.

### Implikasi Governance

- Ada **biometric-adjacent artifact** berupa foto wajah.
- Foto disimpan dalam URL yang tampaknya dapat diakses dari `public/uploads/...`.
- Ada minimal dua jejak penyimpanan:
  1. file selfie,
  2. log verifikasi wajah.

---

## 2.2 Precise Location Tracking

### Client Collection

File utama:

- `mobile-netmanager/src/services/LocationTrackingService.ts`

Data yang dikumpulkan saat ini:

- `latitude`
- `longitude`
- `accuracy`
- `altitude`
- `speed`
- `heading`
- `batteryLevel`
- `isMoving`
- `recordedAt`

Perilaku saat ini:

- Tracking aktif setelah check-in dan berhenti setelah check-out.
- Meminta foreground + background permission.
- Menyimpan pending queue lokasi lokal di storage (`@pending_locations`) jika gagal kirim.
- Membatasi local pending queue ke **100 lokasi terakhir**.
- Menyimpan state terakhir seperti `@last_sent_location` dan tracking state lokal.
- Mengirim lokasi ke `/api/mobile/location`.

### Server Intake

File utama:

- `netmanager/app/api/mobile/location/route.ts`

Perilaku saat ini:

- Memvalidasi payload dengan Zod.
- Mendukung single update dan batch sync (`locations: []`).
- Menolak penyimpanan jika user belum check-in, dan mengembalikan `shouldStopTracking: true`.
- Menyimpan lokasi via `LocationTrackingService` backend.

### Implikasi Governance

- Ini bukan hanya “absen lokasi”; ini adalah **movement-capable location stream** selama sesi kerja aktif.
- Kombinasi `latitude/longitude + recordedAt + isMoving + batteryLevel` cukup sensitif untuk inferensi kebiasaan/pergerakan.
- Ada dua area retention:
  1. local device queue,
  2. server-side saved locations.

---

## 2.3 Attendance Telemetry

File utama:

- `mobile-netmanager/src/services/AttendanceTelemetryService.ts`

Perilaku saat ini:

- Telemetry ditulis ke `logger.info` dengan prefix `[AttendanceTelemetry]`.
- Event yang ada saat ini:
  - `attendance_submit_started`
  - `attendance_photo_upload_started`
  - `attendance_photo_upload_succeeded`
  - `attendance_photo_upload_failed`
  - `attendance_queued_offline`
  - `attendance_api_succeeded`
  - `attendance_api_failed`
  - `attendance_replay_succeeded`
  - `attendance_replay_failed`
  - `attendance_duplicate_blocked`

Payload yang bisa ikut tercatat:

- `requestId`
- `userId`
- `networkState`
- `queueDepth`
- `endpoint`
- `action`
- `latencyMs`
- `reason`
- `retryCount`

### Implikasi Governance

- Telemetry saat ini belum terlihat mencatat lokasi presisi, tetapi tetap mencatat metadata operasional yang bisa dipakai untuk rekonstruksi perilaku user.
- Perlu kepastian apakah logger ini:
  - hanya lokal/dev,
  - masuk ke observability pipeline production,
  - atau ikut tersimpan jangka panjang di remote logging sink.

---

## 2.4 Attendance Photo Upload

File utama:

- `mobile-netmanager/src/services/UploadService.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`
- `netmanager/app/api/mobile/upload/route.ts`

Perilaku saat ini:

- Foto absensi di-upload dengan tipe `employee-attendance`.
- Mobile upload service mengirim file multipart dengan auth bearer token.
- Upload dilakukan sebelum submit attendance online, atau sebagai bagian dari replay flow offline.

### Implikasi Governance

- Attendance photo adalah artifact operasional, tetapi tetap sensitif karena dapat berisi wajah, waktu, dan konteks lokasi kerja.
- Perlu dibedakan governance-nya dari face verification selfie, karena tujuan pemrosesannya berbeda.

---

## 3. Risiko Governance yang Sudah Terlihat

## 3.1 Belum ada keputusan retention yang eksplisit di level implementasi

Belum terlihat kebijakan eksplisit di code/doc saat ini untuk:

- retention selfie verification,
- retention attendance photo,
- retention location history,
- retention log telemetry attendance,
- retention local pending queue setelah logout/device loss.

## 3.2 Access model belum terdokumentasi lintas artifact

Belum ada doc teknis yang menyatukan pertanyaan berikut:

- siapa yang boleh melihat selfie verification,
- siapa yang boleh melihat attendance photo,
- siapa yang boleh melihat precise location trail,
- apakah supervisor/admin boleh melihat semua, atau hanya ringkasan,
- apakah support/devops bisa melihat raw artifact di storage/logs.

## 3.3 Public-path storage untuk face verification perlu review

Karena file verifikasi wajah saat ini ditulis ke `public/uploads/mitra`, perlu dipastikan apakah:

- URL benar-benar public,
- ada proteksi access layer di atasnya,
- atau ini hanya public-by-path tapi tidak mudah diekspos.

Jika benar public, ini harus dianggap **high priority governance concern**.

## 3.4 Local device queue adalah retention juga

`@pending_locations` dan state tracking lokal berarti device menyimpan data sensitif sementara. Ini tetap perlu kebijakan:

- kapan dihapus,
- apa yang terjadi saat logout,
- apa yang terjadi jika app uninstall / device compromise,
- apakah payload perlu enkripsi tambahan di luar storage default.

---

## 4. Keputusan yang Harus Dibuat

## 4.1 Face Verification

Tim perlu memutuskan:

1. Berapa lama selfie verification disimpan?
2. Apakah `fotoDiri` dipakai hanya untuk verification proof, atau juga sebagai profile image permanen?
3. Siapa yang boleh mengakses raw selfie?
4. Apakah log verifikasi wajah perlu retention lebih panjang dari file selfie, atau sebaliknya?
5. Apakah file harus dipindah dari public-path storage ke storage yang lebih terbatas?

## 4.2 Attendance Photo

Tim perlu memutuskan:

1. Attendance photo disimpan berapa lama?
2. Apakah attendance photo boleh diakses semua admin, atau hanya role tertentu?
3. Apakah attendance photo boleh ikut muncul di export/report atau hanya di detail terbatas?

## 4.3 Location Tracking

Tim perlu memutuskan:

1. Retention location trail per sesi berapa lama?
2. Apakah semua koordinat detail perlu disimpan, atau cukup ringkasan/last known points?
3. Siapa yang boleh melihat:
   - latest location,
   - historical trail,
   - batch synced points?
4. Apakah data seperti `batteryLevel`, `speed`, `heading`, `altitude` memang dibutuhkan operasional?

## 4.4 Telemetry / Logging

Tim perlu memutuskan:

1. Apakah attendance telemetry production masuk ke central logging?
2. Jika ya, retention-nya berapa lama?
3. Apakah `userId`, `requestId`, `reason`, dan endpoint dianggap cukup aman untuk retained logs?
4. Apakah ada field yang harus di-redact atau dipseudonimkan?

---

## 5. Rekomendasi Teknis Jangka Pendek

1. **Tetapkan retention matrix tertulis** untuk 4 artifact utama:
   - face verification selfie,
   - attendance photo,
   - location history,
   - attendance telemetry/log.

2. **Pisahkan access policy per artifact**, jangan disamaratakan sebagai “data absensi”.

3. **Review public accessibility** untuk `public/uploads/mitra` dan storage attendance photo.

4. **Audit logging sink production** untuk memastikan payload attendance telemetry tidak masuk ke retention jangka panjang tanpa keputusan formal.

5. **Dokumentasikan local-device cleanup rules** untuk pending location queue dan tracking state.

6. **Pertimbangkan minimization** untuk field lokasi yang tidak selalu dibutuhkan (`altitude`, `heading`, `batteryLevel`, `speed`).

---

## 6. Usulan Retention Matrix Awal (Draft)

> Ini bukan kebijakan final. Ini hanya draft teknis untuk didiskusikan.

| Data | Tujuan | Akses Minimal | Retention Draft | Catatan |
|---|---|---:|---:|---|
| Face verification selfie | bukti verifikasi wajah | sangat terbatas | pendek / terbatas | jangan diasumsikan sama dengan profile photo |
| Face verification log | audit event | terbatas | menengah | bisa lebih lama dari file selfie |
| Attendance photo | bukti operasional absensi | admin/supervisor terbatas | menengah | beda tujuan dengan selfie verification |
| Location history | operasional live tracking / audit sengketa | sangat terbatas | pendek | detail trail paling sensitif |
| Attendance telemetry log | observability / debugging | engineering terbatas | pendek | wajib field review sebelum retention panjang |
| Pending location queue (device) | reliability offline | device-local only | sangat pendek | hapus saat sync/logout/cleanup |

---

## 7. File Bukti Kunci

- `mobile-netmanager/src/components/organisms/FaceVerificationModal.tsx`
- `netmanager/app/api/mobile/mitra/verify-face/route.ts`
- `mobile-netmanager/src/services/LocationTrackingService.ts`
- `netmanager/app/api/mobile/location/route.ts`
- `mobile-netmanager/src/services/AttendanceTelemetryService.ts`
- `mobile-netmanager/src/services/UploadService.ts`
- `mobile-netmanager/app/(app)/absensi.tsx`

---

## 8. Penutup

Secara teknis, sistem kehadiran sekarang sudah jauh lebih rapi dibanding awal audit. Tetapi makin rapi sistemnya, makin penting membedakan antara **data operasional** dan **data sensitif**.

Face verification, precise location, attendance photo, dan telemetry tidak boleh dikelola hanya sebagai “detail implementasi”. Semuanya sudah menjadi bagian dari kontrak produk dan kontrak kepercayaan dengan user. Karena itu, langkah berikutnya bukan cuma refactor lagi, tetapi memastikan retention, access, dan minimization untuk artifact ini diputuskan secara eksplisit.
