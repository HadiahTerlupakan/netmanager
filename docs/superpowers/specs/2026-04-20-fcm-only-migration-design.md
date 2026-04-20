# FCM-Only Notification Migration Design

## Ringkasan

Desain ini memigrasikan notifikasi web project ke **FCM-only** dengan **hard cutover**. Jalur web-push lama berbasis `PushSubscriptions`, route `/api/notifications/subscribe`, worker recovery subscription, dan konfigurasi VAPID private key di server dihapus total. Sistem target hanya menyisakan dua boundary notifikasi web:
- **browser registration** melalui Firebase Web Messaging
- **server delivery** melalui Firebase Admin

Migrasi ini mencakup perubahan frontend, backend, deployment Jenkins/Kubernetes, test, dan cleanup permanen data/schema legacy.

## Masalah yang ingin diselesaikan

Saat ini codebase masih memiliki dua jalur notifikasi web yang hidup berdampingan:
- jalur **FCM** di `hooks/useFCM.ts` yang memakai `getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY })` lalu mengirim token ke `/api/user/fcm-token`
- jalur **web-push legacy** di `app/api/notifications/subscribe/route.ts`, `modules/notification/services/PushNotificationService.ts`, `worker/pushSubscriptionRecovery.ts`, dan model Prisma `PushSubscriptions`

Dampak dari arsitektur campuran ini:
1. browser/UI masih bisa menyentuh jalur legacy walau target produk sudah memakai Firebase
2. route legacy mengembalikan `503` jika VAPID private key server tidak diisi, sehingga memunculkan kegagalan yang tidak relevan untuk setup FCM-only
3. deployment K8s saat ini hanya memuat Firebase Admin runtime env, tetapi belum memodelkan dengan jelas kebutuhan **build-time** `NEXT_PUBLIC_*` untuk browser bundle
4. schema dan worker legacy mempertahankan kompleksitas yang seharusnya tidak dibutuhkan lagi

## Tujuan desain

Migrasi ini harus menghasilkan keadaan akhir berikut:
1. Semua notifikasi web hanya memakai **FCM**.
2. Tidak ada lagi route, service, worker recovery, atau tabel yang khusus untuk web-push subscription lama.
3. Browser token registration hanya terjadi melalui Firebase Web SDK.
4. Server delivery hanya terjadi melalui Firebase Admin SDK.
5. Jenkins dan K8s memiliki boundary konfigurasi yang jelas antara env build-time dan runtime.
6. Data/schema legacy dibersihkan permanen pada rollout ini.

## Konteks kode saat ini

### 1. Browser registration FCM sudah ada
`hooks/useFCM.ts` sudah meminta permission browser, memanggil `getToken(...)`, lalu mengirim token ke `/api/user/fcm-token`. Ini adalah jalur registration yang akan dipertahankan.

### 2. Firebase client config sudah ada
`lib/firebase/config.ts` sudah membangun app browser dari env `NEXT_PUBLIC_FIREBASE_*` dan menginisialisasi `getMessaging(app)`.

### 3. Firebase Admin delivery sudah ada
`lib/firebase/admin.ts` dan `lib/firebase/messaging.ts` sudah menyiapkan credential server-side dan pengiriman multicast melalui Firebase Admin. Ini adalah jalur delivery yang akan dipertahankan.

### 4. Jalur web-push legacy masih aktif
Route `app/api/notifications/subscribe/route.ts` masih bergantung pada `isPushConfigured()` dari `modules/notification/services/PushNotificationService.ts`. Service worker `worker/index.ts` masih menangani `PUSH_CONFIG` dan `pushsubscriptionchange`, lalu memanggil `recoverPushSubscription(...)` ke route legacy. Model Prisma `PushSubscriptions` masih menyimpan subscription endpoint/p256dh/auth untuk jalur lama.

### 5. Deployment belum selaras dengan kebutuhan browser bundle
Manifest K8s staging dan production saat ini sudah memuat runtime Firebase Admin env (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`), tetapi belum memuat `NEXT_PUBLIC_VAPID_PUBLIC_KEY` maupun env browser Firebase di manifest/secrets. Di Next.js, `NEXT_PUBLIC_*` dibundel saat build, jadi Jenkins harus menyediakannya pada tahap build image.

## Pendekatan yang dipilih

Pendekatan yang dipilih adalah **hard cutover satu paket**:
- semua consumer web dipindahkan atau ditegaskan ke jalur FCM-only
- semua artefak legacy dihapus dalam rollout yang sama
- schema dan data lama dibersihkan permanen
- deployment diperjelas agar build-time dan runtime configuration tidak tercampur

Pendekatan ini dipilih karena tujuan user adalah migrasi langsung tanpa masa kompatibilitas, dan karena mempertahankan dua jalur notifikasi akan terus memunculkan state campuran yang rawan salah konfigurasi.

## Desain target

### 1. Arsitektur akhir
Arsitektur akhir hanya memiliki dua alur:

#### A. Browser registration
- frontend mengambil config Firebase dari `NEXT_PUBLIC_FIREBASE_*`
- frontend mengambil FCM registration token via `getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY })`
- frontend mengirim token ke backend registry `/api/user/fcm-token`

#### B. Server delivery
- backend mengambil token FCM dari registry yang dipakai aplikasi saat ini
- backend mengirim notifikasi melalui Firebase Admin SDK
- browser/service worker Firebase menangani presentasi notification sesuai runtime browser

Tidak ada lagi alur subscription endpoint/p256dh/auth.

### 2. Boundary komponen yang dipertahankan
Komponen yang dipertahankan:
- `hooks/useFCM.ts`
- `lib/firebase/config.ts`
- `lib/firebase/admin.ts`
- `lib/firebase/messaging.ts`
- endpoint registry token FCM yang sudah dipakai frontend

Boundary ini sudah sesuai dengan target FCM-only dan tinggal diperjelas kontraknya.

### 3. Komponen legacy yang dihapus
Komponen berikut dihapus total dari codebase:
- `app/api/notifications/subscribe/route.ts`
- `modules/notification/services/PushNotificationService.ts` jika setelah audit file ini hanya relevan untuk web-push legacy
- repository/model/service yang hanya melayani `PushSubscriptions`
- `worker/pushSubscriptionRecovery.ts`
- logic `PUSH_CONFIG` dan `pushsubscriptionchange` di `worker/index.ts` yang hanya berguna untuk subscription recovery legacy
- UI consumer yang masih memanggil `/api/notifications/subscribe`, termasuk manager/banner notifikasi yang bergantung pada route tersebut
- env legacy `VAPID_PRIVATE_KEY` dan `VAPID_SUBJECT` dari deployment/runtime

### 4. Data dan schema target
Schema target tidak lagi memiliki model `PushSubscriptions` di Prisma utama.

Migrasi database harus:
1. menghapus record `push_subscriptions`
2. menghapus tabel `push_subscriptions`
3. menghapus repository/service/test yang bergantung pada tabel tersebut

FCM token registry yang saat ini dipakai pada user/mitra tetap dipertahankan.

### 5. Konfigurasi environment target
#### Build-time di Jenkins
Jenkins harus menyediakan env berikut **saat build image**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Alasan: `NEXT_PUBLIC_*` dibundel ke JavaScript browser pada saat `next build`.

#### Runtime di Kubernetes
K8s runtime hanya perlu menyuplai credential server-side berikut:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL` bila dipakai

Env runtime legacy berikut dihapus dari kebutuhan deployment:
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

### 6. Error handling target
- jika env browser Firebase atau `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tidak tersedia saat build, fitur FCM web harus tampil sebagai **disabled** secara eksplisit dan tidak mencoba jatuh ke jalur legacy
- jika Firebase Admin runtime credential tidak tersedia, jalur pengiriman server mengembalikan error operasional yang jelas tanpa mencoba web-push lama
- setelah migrasi, error `503` dari `/api/notifications/subscribe` tidak boleh ada lagi karena route tersebut sudah tidak eksis

## File target untuk implementasi nanti

Prioritas file yang paling mungkin disentuh:
- `hooks/useFCM.ts`
- `lib/firebase/config.ts`
- `lib/firebase/admin.ts`
- `lib/firebase/messaging.ts`
- `app/api/notifications/subscribe/route.ts`
- `modules/notification/services/PushNotificationService.ts`
- `worker/index.ts`
- `worker/pushSubscriptionRecovery.ts`
- `prisma/schema.prisma`
- file migration Prisma yang menghapus `push_subscriptions`
- manifest/stencil deployment staging dan production yang relevan untuk env Firebase
- script/build pipeline Jenkins atau template yang mengontrol build-time env injection

## Strategi rollout

Rollout dilakukan sebagai satu paket atomik dengan urutan berikut:
1. audit semua consumer yang masih memakai route subscribe legacy
2. pindahkan/tegas-kan semua flow browser ke FCM-only
3. hapus route/service/worker legacy
4. tambahkan migrasi schema untuk drop `push_subscriptions`
5. update test agar hanya mengunci perilaku FCM-only
6. update Jenkins build injection untuk semua `NEXT_PUBLIC_*` yang dibutuhkan
7. update K8s secret/template agar hanya menyisakan runtime Firebase Admin env
8. verifikasi build, test, dan startup deployment

## Strategi verifikasi

### Verifikasi statis
- tidak ada referensi lagi ke `/api/notifications/subscribe`
- tidak ada referensi lagi ke `PushSubscriptions`
- tidak ada referensi lagi ke `recoverPushSubscription`
- tidak ada lagi penggunaan `VAPID_PRIVATE_KEY` dan `VAPID_SUBJECT` di runtime deployment

### Verifikasi test
Minimal regression yang harus ada setelah implementasi:
1. test browser registration FCM tetap mengirim token ke `/api/user/fcm-token`
2. test pengiriman server via Firebase Admin tetap lolos
3. test worker tidak lagi mengandung recovery subscription legacy
4. test migrasi/schema memastikan `push_subscriptions` benar-benar dihapus
5. test konfigurasi env/build memastikan jalur FCM-only tidak diam-diam fallback ke route lama

### Verifikasi runtime
Smoke path yang harus lolos:
1. browser login dan memberi izin notifikasi
2. frontend mendapatkan FCM token dan berhasil mendaftarkannya ke backend
3. backend mengirim notifikasi melalui Firebase Admin
4. notifikasi tampil di browser pada runtime yang relevan
5. tidak ada request ke `/api/notifications/subscribe`
6. staging dan production memuat build browser dengan `NEXT_PUBLIC_*` yang benar

## Risiko dan mitigasi

### Risiko 1: ada consumer legacy yang terlewat
Mitigasi: lakukan pencarian lintas repo untuk route subscribe, model `PushSubscriptions`, dan helper recovery sebelum coding.

### Risiko 2: deployment tetap salah karena `NEXT_PUBLIC_*` hanya dipasang di runtime
Mitigasi: desain ini secara eksplisit memindahkan tanggung jawab env browser ke tahap build di Jenkins.

### Risiko 3: cleanup schema memutus bagian lain yang belum terlihat
Mitigasi: drop schema hanya dilakukan setelah audit repository/service/test yang mengakses `push_subscriptions`, dan perubahan dikunci dengan regression test.

## Out of scope

Hal-hal berikut tidak termasuk target desain ini:
- merombak model bisnis notifikasi di luar migrasi FCM-only
- menambah provider push baru selain Firebase
- membuat fallback kompatibilitas sementara untuk web-push lama
- menunda cleanup schema/data ke rollout berikutnya

## Keputusan final

Implementasi berikutnya harus memperlakukan migrasi ini sebagai **penghapusan total jalur web-push legacy** dan **standardisasi penuh ke FCM-only**. Hasil akhir yang benar bukan sekadar hilangnya error `503`, tetapi codebase yang hanya memiliki satu arsitektur notifikasi web, satu model konfigurasi deployment, dan satu sumber kebenaran untuk delivery browser notification.
