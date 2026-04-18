# Production Deploy Guardrails Design

Tanggal: 2026-04-18
Topik: Hardening alur deploy production untuk mencegah drift dan image reference yang salah

## Latar belakang

Insiden production pada 2026-04-18 menunjukkan bahwa workload production dapat berakhir memakai image short-name seperti `netmanager-app:production`, `netmanager-cron:production`, dan `netmanager-radius:production`. Akibatnya Kubernetes mencoba pull dari `docker.io/library/...` dan workload gagal `ImagePullBackOff`.

Investigasi menunjukkan:
- workflow yang diinginkan pengguna adalah `push ke staging -> verifikasi beta -> jalankan deploy-prod.sh -> promote staging ke main -> Jenkins production auto-deploy`
- file `deploy-prod.sh` berfungsi sebagai alat promosi git, bukan eksekutor deploy cluster
- `Jenkinsfile` repo saat ini sudah merender full registry image reference dan bukan sumber langsung image short-name
- cluster production sempat drift dari jalur resmi karena ada intervensi manual dari Rancher saat kondisi darurat
- secret registry production yang diharapkan Jenkins tidak ada di cluster saat investigasi

## Tujuan

1. Mempertahankan workflow pengguna yang sederhana: staging sebagai beta, production sebagai hasil promosi dari staging.
2. Menjadikan Jenkins sebagai satu-satunya jalur deploy production yang sah.
3. Mencegah short-name image, placeholder manifest, atau drift manual masuk ke production.
4. Menyediakan jalur recovery darurat resmi tanpa patch manual dari Rancher/kubectl.

## Non-goals

1. Tidak memigrasikan deployment ke GitOps controller baru.
2. Tidak mengubah staging menjadi environment yang terpisah secara proses dari workflow git saat ini.
3. Tidak menghapus `deploy-prod.sh`; script tetap dipakai sebagai alat promosi staging ke main.

## Desain tingkat tinggi

Alur resmi setelah perbaikan:
1. Developer push ke `staging`.
2. Jenkins staging build dan deploy ke environment beta.
3. Setelah staging tervalidasi, pengguna menjalankan `./deploy-prod.sh`.
4. `deploy-prod.sh` melakukan promosi `origin/staging` ke `main` dengan preflight ketat.
5. Push ke `main` memicu Jenkins production.
6. Jenkins production melakukan preflight deploy, render manifest, verifikasi anti-drift, lalu rollout.
7. Jika deployment production gagal, recovery dilakukan melalui job Jenkins resmi untuk known-good image, bukan dari Rancher.

## Komponen desain

### 1. `deploy-prod.sh` tetap sebagai promotion script

Peran script dipertegas sebagai promotion-only:
- memverifikasi working tree bersih
- memastikan `origin/staging` dan `origin/main` tersinkron
- menampilkan commit SHA staging yang akan dipromosikan
- melakukan fast-forward merge `origin/staging -> main`
- push ke `origin/main`
- menutup proses dengan pesan bahwa deploy resmi dilanjutkan oleh Jenkins production

Perubahan penting:
- script tidak boleh memberi kesan bahwa production sudah sukses hanya karena push selesai
- script harus menegaskan bahwa status akhir production ditentukan oleh Jenkins job production

### 2. Guardrail Jenkins production

Jenkins production menjadi gerbang tunggal deploy production.

Preflight wajib:
- branch harus `main`
- namespace target harus `netmanager-production`
- registry secret production wajib ada
- image ref yang akan dipakai harus full registry path yang cocok dengan pola registry resmi
- placeholder seperti `{{APP_IMAGE}}`, `{{CRON_IMAGE}}`, `{{RADIUS_IMAGE}}` tidak boleh lolos ke manifest final
- image short-name seperti `netmanager-app:production` tidak boleh lolos ke cluster

Verifikasi render:
- deployment manifest dirender ke artefak sementara yang bisa diperiksa sebelum `kubectl apply`
- Jenkins memverifikasi field `image:` hasil render sebelum apply
- pipeline fail-fast jika hasil render tidak memakai full registry path

### 3. Anti-drift policy production

Sebelum rollout, Jenkins production harus memeriksa deployment aktif di cluster.

Cluster dianggap drift jika salah satu kondisi berikut terjadi:
- image aktif deployment production tidak memakai registry resmi
- image aktif tidak cocok dengan pola image hasil pipeline resmi
- metadata menunjukkan perubahan dilakukan di luar jalur Jenkins resmi dan belum disinkronkan
- registry secret production tidak tersedia

Ketika drift terdeteksi:
- Jenkins tidak melanjutkan rollout normal
- pipeline gagal dengan pesan yang eksplisit
- operator diarahkan ke jalur recovery resmi, bukan ke Rancher/manual patch

Tujuan anti-drift ini bukan melarang observasi manual, tetapi melarang manual change sebagai workflow operasional production.

### 4. Recovery resmi tanpa manual patch

Karena pengguna memilih bahwa perubahan manual ke production harus dilarang, recovery darurat harus disediakan sebagai jalur resmi.

Recovery resmi berupa Jenkins job khusus yang:
- menerima known-good image reference untuk app, cron, dan radius, atau memilih snapshot terakhir yang sudah tervalidasi
- memverifikasi image ref memakai registry resmi
- memverifikasi namespace dan secret yang dibutuhkan
- melakukan patch/apply lewat pipeline resmi
- menunggu rollout sukses
- mencatat image yang dipulihkan untuk audit berikutnya

Dengan ini, saat production down, pengguna tidak perlu lagi masuk Rancher untuk `kubectl set image` manual.

### 5. Aturan promosi staging ke production

Production hanya boleh menerima hasil promosi dari staging.

Kebijakannya:
- staging adalah beta environment
- production adalah environment promosi, bukan tempat eksperimen
- `deploy-prod.sh` hanya dijalankan setelah staging lolos verifikasi operasional
- Jenkins production deploy dari `main` hasil promosi tersebut

Ini menjaga mental model pengguna tetap sederhana:
- kerja harian di `staging`
- validasi di beta
- promosi ke `main`
- Jenkins production mengeksekusi rollout resmi

## Testing dan verifikasi

### Automated verification

Tambahan test repo perlu mencakup:
- test bahwa Jenkins fail jika registry secret production tidak ada
- test bahwa Jenkins fail jika rendered image bukan full registry path
- test bahwa short-name image tidak pernah boleh masuk manifest final
- test bahwa deploy production hanya berjalan dari branch `main`
- test bahwa recovery job hanya menerima image ref dari registry resmi

### Operational verification

Checklist operasional setelah implementasi:
- jalankan deploy staging biasa
- jalankan `./deploy-prod.sh`
- verifikasi Jenkins production memulai deploy otomatis
- verifikasi pipeline menolak kondisi drift yang disengaja pada cluster uji
- verifikasi recovery job dapat memulihkan workload ke known-good image tanpa Rancher manual patch

## Error handling

Prinsip error handling yang diinginkan:
- fail-fast
- pesan error harus operasional dan langsung bisa ditindaklanjuti
- tidak boleh ada fallback diam-diam ke short-name image atau apply mentah

Contoh kategori error yang harus eksplisit:
- registry secret production hilang
- branch bukan `main`
- rendered manifest masih mengandung placeholder
- image hasil render bukan registry resmi
- cluster production drift dari jalur resmi

## Dampak pada pengguna

Setelah desain ini diterapkan, workflow pengguna tetap familiar:
- push ke `staging`
- cek beta server
- jalankan `./deploy-prod.sh`

Perbedaannya adalah:
- production tidak lagi bergantung pada intervensi manual saat deploy bermasalah
- Jenkins menjadi sumber kebenaran tunggal untuk deploy production
- jalur recovery resmi tersedia saat darurat

## Risiko dan mitigasi

### Risiko 1: false positive drift detection
Mitigasi:
- gunakan aturan drift yang sempit dan eksplisit, fokus pada image path dan metadata deploy resmi
- sediakan pesan error yang menjelaskan kondisi drift yang ditemukan

### Risiko 2: recovery menjadi lebih lambat saat darurat
Mitigasi:
- siapkan recovery job resmi yang sederhana dan cepat dipakai
- pastikan known-good image ref tersimpan jelas

### Risiko 3: secret registry production hilang lagi
Mitigasi:
- Jenkins fail sebelum migration/deploy
- dokumentasi operasional menjelaskan bootstrap dan verifikasi secret sebelum deploy production

## Kriteria sukses

Desain dianggap berhasil jika:
- `deploy-prod.sh` tetap menjadi alat promosi staging ke main
- Jenkins production menjadi satu-satunya jalur deploy production yang sah
- image short-name atau placeholder manifest tidak bisa lagi lolos ke production
- drift manual dari Rancher terdeteksi dan diblokir
- recovery production dapat dilakukan lewat jalur Jenkins resmi tanpa patch manual cluster

## Rekomendasi implementasi

Implementasi sebaiknya dilakukan dalam urutan berikut:
1. perkuat `deploy-prod.sh` sebagai promotion-only script
2. tambah guardrail render dan image validation di Jenkins production
3. tambah anti-drift checks sebelum rollout production
4. tambahkan recovery job resmi untuk known-good images
5. lengkapi test CI dan dokumentasi operasional
