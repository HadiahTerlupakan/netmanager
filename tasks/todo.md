# Rencana: Notifikasi WO bisa dibuka verifikator di mobile (2026-11-03)

Status: **dikerjakan**

## Temuan (uji di HP Redmi via adb)
- Tap push "Work Order Baru" → Beranda: `data.url` = rute web `/admin/workorders/<id>`;
  handler tap push hanya membaca `url`. Diperbaiki di mobile `faa8cc7` (rute dari
  `sourceType`/`sourceId`, sama dengan daftar notifikasi in-app).
- Detail WO mobile menolak verifikator: `WO-20261103-0001` (CARIU/Technical) →
  "Anda tidak punya akses ke data ini". Mobile hanya mengizinkan pemegang/partner atau
  kolam klaim (site+departemen sendiri), padahal web & notifikasi mengizinkan verifikator
  tanpa `workorders:site_only` melihat semua site.

## Keputusan
- [Asumsi] Verifikator boleh MELIHAT detail WO di mobile bila web juga mengizinkan
  (`workorders:read` + lingkup site/departemen web). Klaim & aksi tetap aturan lama.
- Kontrak: detail mobile mengembalikan `viewerAccess: "PARTICIPANT" | "CLAIMABLE" | "OBSERVER"`;
  aplikasi menyembunyikan tombol aksi untuk OBSERVER.

## Langkah
- [x] Server: jalur baca detail mobile + `viewerAccess`, tes.
- [x] Mobile: sembunyikan aksi untuk OBSERVER, tes (mobile `b125034`; tap push `faa8cc7`).
- [x] Pemilih site web: `/api/sites` tanpa resource tidak lagi memakai `role.isRestricted`;
      pemilih PPP & mitra kirim resource-nya.
- [x] Review independen; typecheck, lint, tes penuh kedua repo; changelog; commit lokal.
- [ ] Push netmanager (deploy) + mobile (OTA) setelah "push"; uji ulang di HP.

# Rencana: Tegakkan pembatasan site/departemen di semua modul (2026-11-02 s/d 2026-11-03)

Status: **selesai di lokal, menunggu "push"** (commit `5fd1e8821` sudah deploy; `9c1b01789` belum)

Catatan proses: rencana ini ditulis setelah pengerjaan, bukan sebelumnya — lihat
`tasks/lessons.md` (2026-11-03).

## Patokan
- Tanpa `<resource>:site_only` → semua site di tenant; dengan toggle → hanya site
  pengguna (semua `userSites`, cadangan `siteId`), gagal tertutup bila tanpa site.
  `department_only` serupa. Super admin bebas.
- Izin lingkup dicocokkan persis (`includes`), bukan `hasPermission` (mengembangkan `*`).
- Di luar lingkup untuk satu resource → 404.

## Langkah
- [x] Audit WO & inventory, lalu modul lain; perbaiki + tes (commit `5fd1e8821`, sudah deploy).
- [x] Cek data produksi: user terbatas tanpa site, `siteId` tanpa `user_sites`, gudang tanpa site.
- [x] Sisa putaran 1: multi-site WO/pengguna/SDM/pembayaran manual, reminder departemen,
      klaim garansi, super admin nama role, material admin, detail barang, modul Site +
      jadwal SO, `*` di proyek/sales/MikroTik, toggle katalog yang mati.
- [x] Sisa putaran 2: izin aksi router MikroTik `[id]`, pengeluaran cek persis + multi-site,
      kunci material WO final, laporan presence multi-site, penerima pengingat SO.
- [x] Typecheck + lint + suite penuh (1344 file / 10112 tes); changelog; commit lokal.
- [x] Audit kepatuhan CLAUDE.md atas commit (49 klaim → 8 pelanggaran nyata), semua diperbaiki.

## Review (2026-11-03)
- Suite penuh: 1345 file / 10118 tes lulus; typecheck & lint bersih.
- Temuan reviewer yang diperbaiki: PATCH site bisa menautkan gudang site lain (pelebaran
  lingkup sendiri); route performa user tanpa cek tenant/site; site utama bisa tercabut
  lewat `userSites`; riwayat lokasi punya jalur lingkup sendiri.
- Audit kepatuhan: repository pengingat SO bergantung ke services; duplikasi aturan
  lingkup opname, filter site pengeluaran vs RAB, blok cek akses route performa, guard
  tenant & pesan di `AdminUserRouteService`, literal scope super admin di cuti; JSDoc usang.
  Semua diperbaiki (helper bersama `irisanSiteDiminta`/`siteDefaultLingkup` di `modules/roles`,
  `isDibatasiSite` di inventory, `toUserRouteApiError`).
- Proses: rencana ini ditulis terlambat (setelah pengerjaan) — dicatat di `tasks/lessons.md`.
- [ ] Push (menunggu instruksi "push" dari user).

# Rencana: Semua push pindah ke FCM, Expo dihapus (2026-11-02)

Status: **dikerjakan**

## Bukti Expo sudah mati
- Aplikasi berhenti memakai Expo push di commit mobile `d616a7b` (2026-04-16, ±build 39).
- Production `GET /api/mobile/app-version/check?currentVersionCode=39` → `isForceUpdate: true` (minimum = build 51).
- Aplikasi sekarang tidak punya `expo-notifications`/`getExpoPushTokenAsync`.

## Batasan
- Kolom DB `pushToken`/`pushTokenUpdatedAt` TIDAK dihapus (tanpa migration destruktif); hanya berhenti dipakai untuk kirim.
- Filter penerima WhatsApp tidak diubah.
- Satu notifikasi = satu push: jalur `createNotification` (sudah FCM) + push Expo eksplisit → hapus yang eksplisit, jangan diganti (cegah dobel).

## Langkah
- [x] `ActorPushService`: buang kanal Expo.
- [x] `NotificationService.delivery`: buang Expo; `skipExpoPush` → `skipPush` (berlaku ke FCM pengguna & departemen; maksud aslinya: karyawan cuti tidak dipush).
- [x] Work order: 3 jalur createNotification+Expo → hapus Expo eksplisit; pengingat WO → `sendPushToActors`.
- [x] Pengingat absensi: `pushToken` → punya token FCM; kirim lewat `sendPushToActors`.
- [x] Pengumuman: Expo (`lib/expo`) → FCM, tetap lewati karyawan cuti.
- [x] `CustomerPushService`: buang kanal Expo.
- [x] `getAdminTokens`: filter basi memakai `pushTokenUpdatedAt` (timestamp Expo) → hapus; token mati dibersihkan saat FCM menolak.
- [x] Hapus: `ExpoPushService(+helpers)`, `PushRetryQueue(+helpers)` + start di `server.ts` + endpoint monitoring, `lib/expo.ts`, job `expo_push`, route `/api/mobile/push-token` + service-nya, fungsi repository yang jadi mati, dependensi `expo-server-sdk`.
- [x] Tes: perbarui yang terdampak, hapus tes kode yang dihapus, tambah tes regresi.
- [x] typecheck + lint + suite penuh; changelog; commit.

## Review (2026-11-02)
- Suite penuh: 1305 file / 9648 tes lulus; typecheck & lint bersih.
- Temuan reviewer yang diperbaiki: push pengumuman tanpa filter tenant; cron
  `cleanup-stale-fcm-tokens` menghapus token FCM aktif karena `pushTokenUpdatedAt`
  tidak disegarkan saat sinkron FCM.
- Pelajaran: impor statis pengirim FCM menarik Firebase Admin ke modul yang
  banyak diimpor → hook tes timeout saat paralel; pertahankan lazy import.

# Rencana: Self-Assessment Komdigi dua jenis izin (Jartaplok PS + ISP)

Tanggal: 2026-10-07
Status: **menunggu persetujuan sebelum implementasi**

## Keputusan yang sudah ditetapkan

- Satu tenant bisa memegang **kedua** izin sekaligus → dua menu tampil bersamaan,
  isian & laporan disimpan terpisah per jenis izin.
- ISP mendukung **kedua** sub-jenis: Media Akses Jaringan Bergerak Seluler dan
  Media Akses Jaringan Tetap Lokal (Packet Switched).
- Parameter otomatis ditentukan dari dokumen resmi, bukan ditanyakan — hasil
  pemetaannya ada di bawah.

## Sumber acuan

Diunduh dan dibaca langsung dari folder Komdigi:

- `Draft Self Assessment Jartaplok-PS.docx` — 6 parameter, satu blok
- `Draft Self Assessment Layanan Akses Internet (ISP).docx` — dua blok sub-jenis
- `Panduan Pelaporan QoS ISP.pdf` — 20 halaman, memuat definisi, pengecualian,
  dan rumus tiap parameter ISP

## Pemetaan parameter ISP ke data aplikasi

Kolom "Sumber" menyatakan apakah sistem bisa menghitung sendiri.

### Blok B — ISP via Jaringan Tetap Lokal (Packet Switched), 9 parameter

| Parameter | Tolok | Sumber |
|---|---|---|
| Packet loss (Drop Rate) | ≤ 5% | Manual — uji lapangan bergerak & diam |
| Network latency ≤ 250 mdet | ≥ 90% | Manual — uji lapangan |
| Network availability | ≥ 99% | Manual |
| Pemenuhan pasang baru ≤ 7 hari kalender | **≥ 95%** | **Otomatis** — work order instalasi (sudah ada; target beda dari Jartaplok 90%) |
| Keluhan akurasi tagihan ÷ total tagihan | ≤ 5% | **Otomatis** — `SupportTickets.category=BILLING` ÷ `Invoice` (database billing) |
| Keluhan umum pengguna yang diselesaikan | ≥ 95% | **Otomatis** — tiket `ACCOUNT`+`OTHER` ber-`resolvedAt` ÷ yang diterima |
| Laporan gangguan ÷ jumlah pelanggan (12 bulan) | ≤ 5% | **Otomatis** — tiket `TECHNICAL` ÷ `Pelanggan` |
| Kecepatan jawab panggilan ≤ 30 detik | ≥ 90% | Manual — tidak ada log call center |
| Kecepatan jawab email ≤ 3×24 jam | ≥ 90% | Manual — tidak ada log email masuk |

### Blok A — ISP via Jaringan Bergerak Seluler, 13 parameter

Sama seperti di atas, dengan perbedaan:

- Tambahan **Download Successful Rate** (≥ 80%) dan **Upload Successful Rate**
  (≥ 75%) — manual, uji lapangan
- Tidak memuat network availability
- Tolok ukur keluhan lebih ketat: akurasi tagihan ≤ 2%, laporan gangguan ≤ 2%
- Tambahan **penyelesaian keluhan akurasi tagihan pascabayar ≤ 15 hari kerja**
  (≥ 90%) — **otomatis** dari `resolvedAt` tiket `BILLING`
- Tambahan **penyelesaian keluhan pemotongan deposit prabayar ≤ 15 hari kerja**
  dan **aktivasi paket data ≤ 15 menit** — manual; tidak relevan bila tenant
  tidak menyelenggarakan akses seluler, dibiarkan kosong

### Jartaplok PS (yang sudah ada)

Tidak berubah: 6 parameter, pasang baru ≥ 90%, pemulihan layanan ≥ 90%.
Catatan: **"pemulihan layanan" tidak ada di dokumen ISP** — jangan ikut dibawa.

## Langkah kerja

### Tahap 1 — Dimensi jenis izin pada domain ✅
- [x] `LicenseScheme = "JARTAPLOK_PS" | "ISP"`, ISP berblok `SELULER` dan
      `JARTAPLOK_PS` — `modules/regulatory/domain/license-schemes.ts`
- [x] Katalog per-skema menggantikan Record datar; tolok ukur jadi atribut
      parameter (pasang baru 90% vs 95%)
- [x] `manualParametersOf` / `autoParametersOf` menggantikan daftar datar
- [x] Uji: 16 test katalog + 5 test pencocokan ke formulir resmi

      Pencocokan silang ke `.docx` resmi menemukan satu kesalahan transkripsi:
      blok Jartaplok pada formulir ISP memakai redaksi pasang baru yang berbeda
      ("dalam waktu 7 (tujuh) hari kalender"), bukan redaksi blok Seluler.
      Sudah dibetulkan dan dikunci test.

### Tahap 2 — Penyimpanan terpisah per izin ✅
- [x] Kunci diberi akhiran per skema; **Jartaplok sengaja memakai kunci warisan
      tanpa akhiran**, sehingga tenant yang sudah mengisi tidak perlu migrasi
      data sama sekali — nol risiko kehilangan
- [x] `scheme` menembus port store, service, validator, dan route API
- [x] Jenis izin bawaan & berkas template mengikuti skema
- [x] `ManualAchievementKey` tidak lagi union statis (ruang kunci bergantung
      skema); keamanan tipe yang hilang diganti penjaga runtime
      `pastikanKunciSesuaiSkema`
- [x] Uji: 5 test pemisahan kunci + 6 test penjaga kunci + 2 test skema ISP

### Tahap 3 — Sumber data baru ✅
- [x] Port `TicketSource` & `BillingVolumeSource`
- [x] Domain `complaint-evaluation.ts` — rumus murni sesuai Panduan QoS,
      termasuk arah tolok ukur (≤ vs ≥) yang berbeda antar-parameter
- [x] Adapter `SupportTicketCounts` & `BillingVolume` (tagihan dari database
      billing terpisah, pelanggan dari database utama)
- [x] Uji: 10 test rumus, termasuk regresi "keluhan 3% atas tolok ≤2% harus
      dinyatakan TIDAK memenuhi"

      Belum tercakup: pengecualian perhitungan Panduan huruf C dan agregasi
      3-bulanan → tahunan untuk parameter keluhan. Lihat Risiko.

### Tahap 4 — Dokumen & lampiran ✅
- [x] `self-assessment-isp.docx` dibangun **dari berkas resmi Komdigi** dengan
      menyisipkan penanda ke sel kosong — tata letak tetap milik Komdigi, bukan
      disusun ulang. 7/7 identitas, 22/22 parameter, 4 isian halaman pernyataan
- [x] Nama penanda jadi atribut katalog (`placeholder`), sehingga template
      Jartaplok yang sudah dipakai tetap terisi tanpa diubah
- [x] `buildDocumentValues` katalog-driven, bukan 6 parameter hardcoded
- [x] Laporan menyaring parameter work order per skema — Lampiran ISP tidak
      lagi memuat "pemulihan layanan" yang tidak ada di formulirnya
- [x] Uji: 9 test kecocokan penanda template ↔ katalog, dan render nyata kedua
      dokumen tanpa penanda tersisa

      Dua kesalahan tertangkap saat verifikasi: peta berbasis judul membuat
      7 penanda blok Seluler tertimpa blok Jartaplok (judulnya identik), dan
      regex `<w:t[^>]*>` ikut menangkap `<w:tab/>` sehingga XML rusak.
      Keduanya diperbaiki; pencocokan kini berurutan mengikuti katalog.

      Diperiksa: dua blok "Network Related" pada template Jartaplok memang ada
      di formulir resminya (5 tabel, 2+2 heading, 6 parameter — identik), jadi
      nilai yang tercetak dua kali itu bentuk formulir Komdigi, bukan cacat.

### Tahap 5 — Menu & halaman ✅
- [x] Menu induk "Self-Assessment" dengan submenu **ISP** dan **Jartaplok PS**
- [x] Route `/admin/regulasi/self-assessment/[skema]`; path lama diarahkan ke
      Jartaplok PS agar tautan tersimpan tidak mati
- [x] `modules/regulatory/client.ts` sebagai entrypoint aman komponen klien —
      barrel modul menarik Prisma ke bundel browser, dan lint menegakkannya
- [x] Pemetaan izin submenu ditambahkan; tanpa itu `REGULASI.ISP` jatuh ke
      resource "isp" dan submenu hilang dari sidebar
- [x] Uji: 4 test struktur menu + verifikasi API di server berjalan

### Tahap 6 — Penutup ✅
- [x] lint bersih, typecheck bersih, **6471 test lolos**, build produksi sukses
      (kedua route regulasi terdaftar)
- [x] Changelog terisi

## Risiko & catatan

- **Pengecualian perhitungan** (Panduan huruf C tiap parameter) tidak semuanya
  terekam di aplikasi — mis. "calon pelanggan membatalkan", "fasilitas jaringan
  belum tersedia". Parameter otomatis karenanya perlu kolom pengurang manual,
  atau angkanya akan lebih rendah dari yang semestinya dilaporkan.
- **Agregasi 3-bulanan → tahunan** diatur Lampiran Perdirjen; perlu dipastikan
  rumus agregasi yang sudah dipakai modul ini sama dengan yang diminta ISP.
- Template `.docx` ISP harus disiapkan dari draf resmi; penanda disisipkan tanpa
  mengubah tata letak agar dokumen tetap diterima Komdigi.

## Lanjutan — Lampiran resmi & unduhan terpisah ✅

- [x] Lampiran dibangun dari berkas `.xlsx` resmi Komdigi sebagai template;
      hanya baris sampel yang diisi, judul/kolom/tata letak tidak disentuh
- [x] Tabel pengukuran jaringan dibiarkan berisi baris contoh — datanya dari uji
      lapangan, bukan operasional
- [x] Workbook lama ditawarkan sebagai unduhan terpisah
      (`/api/admin/regulatory/self-assessment/ringkasan`), bukan dibuang:
      sheet Agregasi & Catatan tidak ada padanan di Lampiran resmi
- [x] Sheet "Lampiran I" pada workbook internal diganti "Data Sampel" agar
      berkas internal tidak dikira berkas setoran
- [x] lint bersih, typecheck bersih, **6487 test lolos**, build produksi sukses
- [x] Changelog terisi

## Review

Selesai enam tahap. Tiga kesalahan tertangkap verifikasi, bukan oleh test saya
sendiri:

1. Transkripsi judul pasang baru blok Jartaplok pada formulir ISP keliru —
   ketahuan saat mencocokkan katalog ke `.docx` resmi.
2. Peta penanda berbasis judul membuat 7 penanda blok Seluler tertimpa blok
   Jartaplok (judulnya identik) — ketahuan saat render nyata.
3. Regex `<w:t[^>]*>` ikut menangkap `<w:tab/>` sehingga XML template rusak —
   ketahuan karena dokumennya benar-benar di-render, bukan berhenti di
   "test lolos".

Satu test di `tests/api` sempat gagal akibat perubahan lingkup TIM pada tahap
sebelumnya; saya luput menjalankan direktori itu saat mengubahnya.
