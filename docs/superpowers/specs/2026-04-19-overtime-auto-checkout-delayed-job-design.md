# Overtime Auto Checkout Delayed Job Design

Tanggal: 2026-04-19
Topik: Mengganti polling cron overtime auto-checkout menjadi metadata PostgreSQL + BullMQ delayed job

## Latar belakang

Implementasi overtime auto-checkout saat ini masih memakai internal cron per menit di `lib/cron-registry.ts`. Job tersebut menjalankan `OvertimeAutoCheckoutService.runAutoCheckout()` yang membaca semua overtime `IN_PROGRESS`, menghitung apakah tiap item sudah melewati 8 jam, lalu menutup record yang jatuh tempo.

Pendekatan ini tidak lagi cocok untuk overtime karena jam mulai lembur tidak seragam. Overtime bersifat event-driven: waktu auto-checkout setiap lembur ditentukan oleh `startTime` masing-masing, bukan oleh slot cron global. Akibatnya, cron per menit hanya menjadi polling terus-menerus untuk mencari item yang seharusnya bisa dijadwalkan tepat saat overtime mulai.

Pengguna juga menginginkan riwayat penjadwalan tetap aman saat server restart. Karena itu, state bisnis tidak boleh hanya hidup di Redis/BullMQ. Source of truth harus tetap berada di PostgreSQL.

## Tujuan

1. Menghapus cron overtime auto-checkout sepenuhnya.
2. Menjadikan overtime auto-checkout sebagai delayed job per overtime, bukan polling global per menit.
3. Menyimpan source of truth penjadwalan di PostgreSQL agar aman terhadap restart, drift queue, dan recovery.
4. Menjaga auto-checkout tetap idempotent ketika overtime berubah, selesai manual, atau job lama masih lolos berjalan.
5. Menyediakan mekanisme rehydration agar delayed job bisa dipulihkan dari metadata database.

## Non-goals

1. Tidak mengubah aturan bisnis durasi maksimum lembur 8 jam.
2. Tidak mengubah flow approval overtime selain lifecycle auto-checkout.
3. Tidak mengganti BullMQ dengan scheduler lain.
4. Tidak menambah cron fallback untuk overtime auto-checkout.

## Desain tingkat tinggi

Arsitektur baru terdiri dari tiga komponen:

1. **PostgreSQL metadata schedule** sebagai sumber kebenaran bisnis.
2. **BullMQ delayed job** sebagai mesin eksekusi waktu tunda.
3. **Worker rehydration + executor** sebagai lapisan sinkronisasi antara database dan queue.

Alur resmi setelah perubahan:
1. Overtime masuk status `IN_PROGRESS` dengan `startTime` valid.
2. Service menghitung `scheduledFor = startTime + 8 jam`.
3. Metadata auto-checkout di-upsert ke PostgreSQL.
4. Worker atau service menjadwalkan delayed job BullMQ berdasarkan metadata tersebut.
5. Jika overtime berubah atau selesai manual, metadata diperbarui dan job lama di-invalidasi atau dihapus.
6. Saat delayed job jatuh tempo, worker memuat metadata dari DB, memverifikasi bahwa schedule masih aktif dan versi masih cocok, lalu menyelesaikan overtime.
7. Saat worker restart, semua metadata `SCHEDULED` yang belum memiliki job valid atau belum dieksekusi direhydrate ke BullMQ.

Dengan alur ini, queue menjadi executor, sedangkan database tetap menyimpan niat bisnis dan histori penjadwalan.

## Komponen desain

### 1. Tabel metadata schedule overtime auto-checkout

Tambahkan tabel baru, misalnya `OvertimeAutoCheckoutSchedule`, dengan field inti berikut:

- `id`
- `overtimeId` — relasi 1:1 ke overtime
- `scheduledFor` — waktu auto-checkout yang harus dieksekusi
- `jobId` — identitas BullMQ job terakhir yang dianggap aktif
- `version` — nomor versi schedule, naik setiap kali jadwal berubah
- `status` — `SCHEDULED | COMPLETED | CANCELLED | FAILED`
- `executedAt`
- `cancelledAt`
- `lastError`
- `createdAt`
- `updatedAt`

Aturan model:
- satu overtime hanya boleh punya satu metadata schedule aktif
- `version` dipakai untuk mendeteksi job lama yang sudah stale
- `jobId` boleh kosong bila enqueue belum berhasil atau job perlu direhydrate
- `status` adalah status metadata schedule, bukan status overtime utama

### 2. Scheduling service pada lifecycle overtime

Tambahkan service khusus untuk mengelola metadata dan sinkronisasi queue, misalnya `OvertimeAutoCheckoutSchedulerService`.

Tanggung jawab service ini:
- membuat schedule saat overtime masuk `IN_PROGRESS`
- menjadwalkan ulang saat `startTime` berubah
- membatalkan schedule saat overtime selesai manual atau tidak lagi eligible
- menghasilkan `jobId` deterministik berdasarkan `scheduleId` dan `version`

Service ini tidak melakukan scan semua overtime. Ia hanya bekerja terhadap overtime yang lifecycle-nya sedang berubah.

### 3. Delayed job BullMQ

Tambahkan satu job type khusus, misalnya `overtime-auto-checkout`.

Payload job cukup minimal:
- `overtimeId`
- `scheduleId`
- `version`

BullMQ hanya bertugas menunggu hingga `scheduledFor`, lalu menyerahkan eksekusi ke worker. Queue tidak menjadi sumber kebenaran bisnis.

### 4. Rehydration pada startup worker

Saat worker start, sistem harus membaca semua schedule dengan `status = SCHEDULED` yang belum dieksekusi.

Kandidat rehydration:
- schedule aktif yang `jobId` kosong
- schedule aktif yang job BullMQ-nya hilang
- schedule aktif yang `scheduledFor <= now` tetapi belum dieksekusi

Untuk item overdue, worker harus segera enqueue atau mengeksekusinya secepat mungkin melalui alur yang sama, bukan menunggu cron.

### 5. Penghapusan cron overtime

Entry overtime auto-checkout di `lib/cron-registry.ts` harus dihapus penuh.

Yang dihapus:
- schedule `* * * * *` untuk overtime auto-checkout
- log `"[Cron] Running overtime auto-checkout"`
- ketergantungan runtime pada polling per menit untuk overtime

Perubahan ini hanya untuk overtime auto-checkout. Cron lain tetap mengikuti kebutuhan modul masing-masing.

## Lifecycle detail

### 1. Saat overtime mulai

Ketika overtime berubah ke `IN_PROGRESS` dan memiliki `startTime`:
1. hitung `scheduledFor = startTime + 8 jam`
2. upsert metadata schedule
3. naikkan `version`
4. set `status = SCHEDULED`
5. enqueue delayed job BullMQ dengan payload yang membawa `scheduleId` dan `version`
6. simpan `jobId` job aktif terakhir ke metadata

### 2. Saat overtime berubah

Jika perubahan memengaruhi auto-checkout, terutama `startTime`:
1. hitung ulang `scheduledFor`
2. naikkan `version`
3. perbarui metadata
4. hapus job lama jika masih ada
5. enqueue job baru
6. simpan `jobId` baru

### 3. Saat overtime selesai manual

Jika overtime selesai sebelum auto-checkout jatuh tempo:
1. metadata schedule diubah menjadi `CANCELLED`
2. set `cancelledAt`
3. coba hapus job aktif dari BullMQ
4. bila job lama tetap sempat jalan, worker harus skip karena `status` atau `version` tidak cocok

### 4. Saat delayed job dieksekusi

Worker harus melakukan verifikasi ulang sebelum menyentuh data overtime:
1. baca metadata schedule dari DB
2. validasi `status === SCHEDULED`
3. validasi `version` pada payload sama dengan `version` di DB
4. validasi overtime masih `IN_PROGRESS`
5. validasi `scheduledFor <= now`
6. update overtime menjadi `COMPLETED` dengan `endTime = scheduledFor` dan durasi 8 jam
7. ubah metadata menjadi `COMPLETED`
8. isi `executedAt`

Jika salah satu validasi gagal, job harus berhenti sebagai no-op aman tanpa mengubah overtime.

## Konsistensi data dan idempotensi

Prinsip utama desain ini adalah job lama tidak boleh bisa menimpa state terbaru.

Aturan yang dipakai:
- `version` naik setiap kali schedule berubah
- `jobId` dibuat deterministik dari kombinasi metadata agar duplicate scheduling mudah dikenali
- worker selalu membaca DB sebelum eksekusi
- status overtime tetap divalidasi ulang walaupun job sempat lolos dari queue

Dengan aturan ini:
- job stale akibat reschedule akan skip
- job stale akibat cancel akan skip
- retry BullMQ tidak akan menutup overtime dua kali
- rehydration setelah restart tidak menciptakan side effect ganda

## Failure handling

### 1. Metadata tersimpan, enqueue gagal

Database tetap menjadi source of truth. Schedule tetap `SCHEDULED`, `jobId` boleh kosong, dan item tersebut akan dipulihkan oleh rehydration worker saat startup atau saat recovery loop internal worker dijalankan.

### 2. Job sudah ada, sinkronisasi metadata belum sempurna

Gunakan urutan operasi yang aman:
- simpan atau update metadata dulu
- baru enqueue job
- simpan `jobId` job aktif terakhir setelah enqueue berhasil

Bila langkah akhir gagal, sistem tetap dapat pulih karena metadata schedule masih ada dan bisa direhydrate.

### 3. Worker crash saat eksekusi

BullMQ boleh memakai retry policy ringan. Handler tetap aman karena eksekusi selalu diawali validasi metadata dan state overtime terbaru.

### 4. Job lama tetap berjalan setelah reschedule atau cancel

Worker harus menganggap kondisi ini normal dan menyelesaikannya dengan skip aman berbasis `version` serta `status` metadata. Tidak perlu fallback manual.

## Recovery dan operasional

### Startup recovery

Pada startup worker:
1. query semua metadata `SCHEDULED`
2. cek apakah `jobId` aktif masih ada di BullMQ
3. jika tidak ada atau schedule overdue, enqueue ulang berdasarkan metadata terbaru

### Manual operability

Untuk kebutuhan operasional, sistem sebaiknya punya log terstruktur untuk event berikut:
- schedule created
- schedule rescheduled
- schedule cancelled
- schedule rehydrated
- auto-checkout executed
- auto-checkout skipped karena stale state
- enqueue failed

Fokus log adalah diagnosa sinkronisasi DB ↔ queue, bukan spam eksekusi per menit.

## Testing dan verifikasi

### Automated tests

Tambahan test minimum:
- membuat metadata schedule saat overtime masuk `IN_PROGRESS`
- menjadwalkan ulang metadata dan job saat `startTime` berubah
- membatalkan metadata dan job saat overtime selesai manual
- worker mengeksekusi auto-checkout untuk payload valid
- worker skip untuk schedule `CANCELLED`
- worker skip untuk `version` lama
- worker skip jika overtime bukan `IN_PROGRESS`
- worker merehydrate schedule `SCHEDULED` yang kehilangan `jobId` atau job queue
- worker menangani schedule overdue setelah restart
- regression test memastikan cron overtime di `lib/cron-registry.ts` tidak lagi ada

### Verification scenario

Skenario verifikasi utama:
1. mulai overtime pada jam acak
2. pastikan metadata schedule tercipta dengan `scheduledFor` yang benar
3. restart worker sebelum due time
4. pastikan job kembali tersedia dari metadata DB
5. selesaikan overtime manual sebelum due time
6. pastikan delayed job lama tidak mengubah overtime
7. buat overtime baru dan biarkan lewat 8 jam
8. pastikan worker menutup overtime tepat pada schedule yang disimpan

## Risiko dan mitigasi

### Risiko 1: drift antara metadata DB dan BullMQ

Mitigasi:
- DB tetap source of truth
- startup rehydration wajib
- `jobId` deterministik dan `version` eksplisit

### Risiko 2: stale job mengeksekusi overtime yang sudah berubah

Mitigasi:
- worker wajib validasi `status`, `version`, `scheduledFor`, dan status overtime sebelum update

### Risiko 3: enqueue gagal dan schedule tertinggal

Mitigasi:
- schedule tetap tersimpan di DB
- rehydration menutup gap setelah restart atau recovery
- logging eksplisit untuk enqueue failure

## Kriteria sukses

Desain dianggap berhasil jika:
- cron overtime auto-checkout sudah tidak ada lagi
- overtime tidak lagi diproses dengan polling global per menit
- setiap overtime `IN_PROGRESS` memiliki delayed job berbasis `startTime` masing-masing
- restart worker tidak menghilangkan niat penjadwalan karena metadata tetap ada di PostgreSQL
- overtime yang selesai manual tidak tertimpa job lama
- job stale selalu berakhir skip aman tanpa side effect

## Rekomendasi implementasi

Urutan implementasi yang direkomendasikan:
1. tambah tabel metadata schedule overtime auto-checkout di Prisma schema dan repository/service pendukung
2. tambah BullMQ job type dan worker executor untuk overtime auto-checkout
3. hubungkan lifecycle overtime `IN_PROGRESS`, reschedule, dan manual completion ke scheduler service
4. tambah startup rehydration untuk schedule aktif
5. hapus entry cron overtime auto-checkout dari `lib/cron-registry.ts`
6. lengkapi unit/integration test untuk scheduling, execution, stale-job skip, dan recovery
