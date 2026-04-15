# Admin Notification Delivery Design

## Ringkasan

Tujuan desain ini adalah memulihkan jalur notifikasi admin web agar semua notifikasi admin kembali muncul konsisten pada dua mode runtime:
- foreground: saat portal admin sedang terbuka dan aktif
- background: saat tab tidak aktif atau browser mengandalkan service worker/browser notification

Gejala yang sedang ditangani bukan sekadar bunyi yang hilang, tetapi kasus yang dilaporkan user: semua notifikasi admin tidak muncul sama sekali. Karena itu desain ini memperlakukan masalah sebagai delivery-chain problem, bukan sekadar audio/UI problem.

## Masalah yang ingin diselesaikan

Dari eksplorasi kode saat ini, jalur notifikasi admin web tersebar di beberapa boundary:
- shell admin memasang registrasi notifikasi global di `components/layout/Navbar.tsx`
- foreground realtime admin bell memakai `useRealtimeNotifications()` dari `lib/realtime/hooks/useRealtimeNotifications.ts`
- foreground FCM hook global ada di `hooks/useFCM.ts`
- browser push onboarding ada di `components/notifications/PushNotificationManager.tsx`
- backend subscription ada di `app/api/notifications/subscribe/route.ts`
- background notification handling ada di `worker/index.ts`

Masalah utamanya adalah jalur generic admin notification tidak terlihat memiliki satu presenter yang tegas untuk semua source notifikasi. Payment approval punya perilaku yang lebih eksplisit, tetapi generic admin bell tampak bergantung pada kombinasi realtime hook, FCM hook, dan push worker yang tidak dibatasi secara jelas per mode runtime.

## Tujuan desain

Desain ini harus menghasilkan perilaku berikut:
1. Semua notifikasi admin umum tetap tampil di bell admin realtime.
2. Saat admin sedang membuka portal, notifikasi baru memicu presentasi foreground yang konsisten.
3. Saat admin berada di background, notifikasi baru tetap dapat dipresentasikan oleh browser/service worker.
4. Registrasi web FCM dan browser push tetap dipasang sekali dari shell, tidak tersebar ke tiap bell.
5. WORK_ORDER tetap berada dalam scope notifikasi admin generic sesuai kontrak yang sudah ada.

## Konteks kode saat ini

### 1. Shell navbar memasang registrasi global
`components/layout/Navbar.tsx` memanggil `useFCM();` satu kali di root shell navbar, lalu me-render `PaymentApprovalBell` dan `AdminNotificationBell`. Ini sesuai kontrak existing bahwa registrasi web FCM harus hidup dari shell, bukan dari bell individual.

### 2. Admin bell generic hanya mengonsumsi hook realtime
`components/notifications/AdminNotificationBell.tsx` memakai:
- `useRealtimeNotifications({ limit: 5 })`
- state bell/dropdown
- `markAsRead` dan `markAllAsRead`

Bell ini sendiri tidak mengatur FCM registration. Itu benar untuk separation of concerns, tetapi berarti presenter foreground generic sepenuhnya ditentukan oleh hook realtime yang dipakai.

### 3. Realtime hook generic sudah memuat sound, tetapi masih bercampur concern
`lib/websocket/hooks/useRealtimeNotifications.ts` saat ini:
- melakukan fetch unread + list awal
- menerima event `notification.new` dan `notification.count`
- langsung memainkan sound via `new Audio(...)`
- membaca setting dari `chat_sound_enabled`, `chat_sound_type`, dan `chat_custom_sound_data`
- melakukan optimistic update list dan unread count lokal

Ini menunjukkan presenter foreground generic sebenarnya tersembunyi di dalam hook state/data. Boundary ini terlalu kabur: hook data, unread counter, dan audio playback bercampur dalam satu tempat.

### 4. Foreground FCM saat ini memakai toast berbasis payload title/body
`hooks/useFCM.ts`:
- meminta permission Notification
- mengambil FCM token memakai `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- mengirim token ke `/api/user/fcm-token`
- saat `onMessage`, menampilkan `toast.success(...)` hanya jika `title` dan `body` tersedia

Artinya ada jalur foreground kedua selain realtime hook. Jika payload admin tertentu datang sebagai data-only atau formatnya tidak cocok, jalur ini bisa diam. Ini kandidat kuat untuk mismatch foreground.

### 5. Background browser push hidup di service worker
`worker/index.ts` menangani:
- `PUSH_CONFIG`
- event `push`
- `self.registration.showNotification(...)`
- `notificationclick`
- `pushsubscriptionchange`
- recovery via `recoverPushSubscription(...)`

Artinya background path memang ada, tetapi efektivitasnya tetap bergantung pada subscription yang valid dan payload yang sampai ke worker.

### 6. Kontrak existing yang tidak boleh rusak
`tests/api/admin-notification-contract.test.ts` saat ini sudah mengunci bahwa:
- `WORK_ORDER` tetap ada dalam admin notification contract
- `Navbar.tsx` harus memakai `useFCM();`
- `AdminNotificationBell.tsx` tidak boleh mendaftarkan `useFCM()` sendiri
- admin bell harus memakai import `@/lib/realtime/hooks/useRealtimeNotifications`

Desain fix harus menjaga kontrak-kontrak ini, bukan melawannya.

## Akar masalah yang paling mungkin

Berdasarkan chain di atas, akar masalah yang paling mungkin bukan satu bug tunggal, tetapi salah satu dari dua kelas masalah berikut:

### A. Foreground presenter mismatch
Notifikasi admin baru masuk ke salah satu channel runtime, tetapi presenter foreground generic tidak selalu menampilkannya karena:
- FCM foreground hanya bereaksi ke payload dengan `title` dan `body`
- realtime hook generic menyatu dengan sound logic berbasis `chat_*` storage keys
- tidak ada boundary yang secara eksplisit menyatakan: “untuk notif admin generic, foreground presentation diputuskan di sini”

### B. Background subscription/delivery mismatch
Background path di worker ada, tetapi notifikasi admin umum tetap tidak muncul bila:
- subscription browser tidak aktif/tidak recover
- onboarding push tidak muncul/aktif untuk user admin yang relevan
- payload yang diteruskan ke worker tidak cocok dengan ekspektasi `showNotification`
- jalur FCM dan jalur browser push hidup sendiri-sendiri tanpa fallback yang jelas

## Pendekatan yang dipilih

Pendekatan yang dipilih adalah audit delivery chain penuh lalu fix di boundary terkecil yang benar-benar putus.

Bukan menambah audio baru di `AdminNotificationBell.tsx`, karena itu hanya menambal gejala.

Bukan juga hanya memperbaiki worker atau hanya memperbaiki FCM, karena user meminta scope foreground + background untuk semua notif admin.

## Desain target

### 1. Pisahkan responsibility per runtime boundary
Boundary yang dipertahankan:
- `Navbar.tsx`: memasang registrasi global satu kali
- `AdminNotificationBell.tsx`: hanya render UI unread/list/action
- `useRealtimeNotifications()`: source of truth untuk state bell realtime
- `useFCM()`: registrasi FCM shell-level dan handler foreground FCM
- `PushNotificationManager.tsx` + `worker/index.ts`: onboarding dan background browser push

Boundary yang diperjelas:
- presenter foreground generic admin harus diputuskan secara eksplisit di satu tempat, bukan tersirat dari campuran fetch state dan audio side effect
- handler background harus tetap bergantung pada worker/subscription, bukan UI bell

### 2. Foreground generic admin harus punya presenter yang konsisten
Desain fix akan mengarahkan supaya presentasi foreground generic admin tidak bergantung pada asumsi sempit payload tertentu.

Konsekuensinya:
- jika realtime event adalah source utama notif admin generic, maka presenter foreground untuk admin generic harus berpusat di jalur realtime itu
- jika FCM foreground masih dibutuhkan sebagai jalur aktif, maka handler `onMessage` harus mampu menangani payload admin yang valid, termasuk bila struktur payload tidak selalu hadir sebagai `payload.notification`

Dengan kata lain, implementasi nanti harus memilih satu presenter utama per source, lalu memastikan source itu benar-benar compatible dengan payload admin umum.

### 3. Background tetap dipertahankan lewat push subscription + worker
Desain tidak akan memindahkan background notification ke bell/UI.

Sebaliknya, implementasi nanti akan memvalidasi dan bila perlu mengunci:
- subscription browser tetap bisa dibuat
- config worker (`PUSH_CONFIG`) tetap tersinkron
- `pushsubscriptionchange` tetap mampu recover subscription
- notification click tetap membuka target URL yang relevan

### 4. Jangan gandakan registrasi notif di bell individual
Karena kontrak sudah jelas, `AdminNotificationBell.tsx` tetap tidak akan memanggil `useFCM()` atau memasang registrasi push sendiri.

Jika ada fix registration, fix itu tetap berada di shell/navbar atau manager yang memang bertanggung jawab.

### 5. Payment approval hanya jadi referensi perilaku, bukan tempat menaruh logic generic
Payment approval bell sudah menunjukkan contoh perilaku yang lebih eksplisit. Namun desain ini tidak akan memindahkan generic admin notification ke payment path.

Sebaliknya, payment path hanya dipakai sebagai referensi untuk membandingkan apa yang hilang di generic admin path.

## File target untuk implementasi nanti

Prioritas file yang paling mungkin disentuh:
- `components/layout/Navbar.tsx`
- `hooks/useFCM.ts`
- `lib/websocket/hooks/useRealtimeNotifications.ts`
- `components/notifications/PushNotificationManager.tsx`
- `worker/index.ts`
- `tests/api/admin-notification-contract.test.ts`

Bila diperlukan untuk menambah test runtime yang lebih presisi, kemungkinan juga akan menyentuh test terpisah untuk hook atau worker integration boundary.

## Out of scope

Hal-hal berikut tidak termasuk target desain ini:
- merombak seluruh sistem notification backend
- mengubah kontrak scope `WORK_ORDER` di admin bell
- memindahkan registrasi notif ke bell individual
- menambah fitur preferensi suara baru bila itu tidak diperlukan untuk memulihkan delivery
- menyatukan seluruh jenis notifikasi admin dan payment approval ke satu komponen besar

## Strategi verifikasi

### Verifikasi statis
- pastikan shell admin tetap menjadi satu-satunya titik registrasi FCM
- pastikan admin bell tetap bergantung pada namespace `@/lib/realtime/hooks/useRealtimeNotifications`
- pastikan worker masih menangani `push`, `notificationclick`, dan `pushsubscriptionchange`

### Verifikasi test
Minimal regression yang harus ada setelah implementasi:
1. kontrak navbar-shell untuk `useFCM()` tetap lolos
2. kontrak admin bell tetap tidak mengecualikan `WORK_ORDER`
3. jalur presenter foreground generic admin terkunci oleh test yang membuktikan notif admin valid tidak drop diam-diam
4. jalur background push/subscription punya coverage minimal pada boundary yang paling bertanggung jawab

### Verifikasi runtime
Smoke path yang harus lolos:
1. admin login ke portal dan membuka navbar bell
2. notif admin umum baru masuk saat tab aktif -> muncul di foreground
3. notif admin umum baru masuk saat tab background -> muncul sebagai browser notification
4. klik notification membuka target yang tepat atau memfokuskan window yang ada

## Risiko dan mitigasi

### Risiko 1: fix hanya menyelesaikan foreground
Mitigasi: desain sengaja memaksa audit dua jalur runtime secara terpisah sebelum coding.

### Risiko 2: fix tersebar di terlalu banyak file
Mitigasi: coding nanti hanya menyentuh boundary yang terbukti putus, dengan urutan prioritas presenter foreground dulu lalu registration/background bila perlu.

### Risiko 3: regress kontrak notif admin existing
Mitigasi: pertahankan dan perluas `tests/api/admin-notification-contract.test.ts` sebagai pagar awal.

## Keputusan final

Masalah ini diperlakukan sebagai masalah delivery chain admin notification web.

Fix tidak akan dimulai dari patch bunyi lokal di `AdminNotificationBell.tsx`.

Implementasi berikutnya harus:
- memvalidasi jalur foreground generic admin
- memvalidasi jalur background subscription/worker
- memperbaiki boundary terkecil yang benar-benar memutus chain
- mengunci hasil dengan regression test yang fokus pada kontrak admin notification, bukan pada perilaku payment approval saja
