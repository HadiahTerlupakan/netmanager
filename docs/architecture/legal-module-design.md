# Desain Modul Legal

**Tanggal**: 2026-10-04
**Status**: Disetujui arah — keputusan §8 dari user 2026-10-04
**Scope**: `modules/legal` (baru), `modules/endorsement`, `modules/notification`, admin web

---

## 1. Tujuan

Memberi tenant ISP satu tempat untuk mengelola **kontrak** dan **izin usaha**, dan —
yang paling penting — **mengingatkan sebelum tanggal pentingnya lewat**. Ditambah
pembuatan dokumen legal dari template agar tidak ditulis ulang dari nol.

Pengguna utama adalah **admin yang merangkap urusan legal**, bukan staf legal
penuh waktu. Konsekuensinya:

- Input sekali, selanjutnya sistem yang bekerja (pengingat otomatis).
- Isian minimal; field opsional benar-benar opsional.
- Halaman utama menjawab "apa yang harus saya urus dalam waktu dekat?", bukan
  sekadar tabel arsip.

**Pertanyaan yang harus bisa dijawab modul ini:**

1. Kontrak/izin apa yang habis dalam 90 hari ke depan, dan siapa PIC-nya?
2. Izin apa saja yang sudah kedaluwarsa tapi belum diperpanjang?
3. Kontrak dengan mitra/vendor/pelanggan X apa saja, berapa nilainya, sampai kapan?
4. Lahan/site jaringan mana yang sewanya akan habis?
5. Di mana berkas asli (yang sudah ditandatangani) kontrak ini?

---

## 2. Konteks — apa yang sudah ada

| Fondasi | Dipakai untuk |
|---|---|
| `modules/endorsement` (surat pengesahan) | Penandatanganan kontrak & dokumen hasil template, termasuk penanda tangan internal lewat aplikasi mobile |
| `modules/notification` (in-app, push, email, WA) | Pengingat kedaluwarsa |
| `lib/feature-modules.ts` + `TenantFeatureFlag` | Modul bisa diaktifkan per tenant |
| Penyimpanan R2 (pola `EndorsementStorageService`) | Berkas kontrak/izin — rahasia, disajikan lewat rute server, bukan URL publik |
| `modules/pelanggan`, `mitra`, `reseller`, `procurement` (vendor), `network` (site) | Pihak/objek yang dirujuk kontrak |
| Cron (`cron/entrypoint.sh`) | Pemindaian harian tanggal kedaluwarsa |

Belum ada model kontrak, izin, atau perkara di skema — modul ini baru sepenuhnya.

---

## 3. Lingkup bertahap

| Fase | Isi | Alasan urutan |
|---|---|---|
| **1. Register & pengingat** | Daftar kontrak + izin, berkas, tanggal berlaku, PIC, pengingat otomatis, dasbor "segera berakhir" | Masalah terbesar = lupa tanggal; nilai tertinggi, paling sederhana |
| **2. Template dokumen** | Template per tenant dengan isian otomatis (pelanggan/mitra/vendor), hasil PDF langsung dikirim ke pengesahan; hasil yang sah otomatis masuk register | Masalah kedua = bikin dokumen lambat |
| 3. Perkara & penagihan hukum | Somasi dari tunggakan, kronologi perkara, biaya | Ditunda — belum jadi masalah utama, kompleks untuk admin merangkap |
| 4. Kepatuhan berkala | Checklist kewajiban (laporan Komdigi, UU PDP) | Ditunda — bisa diwakili register izin + pengingat dulu |

---

## 4. Fase 1 — Register & pengingat

### 4.1 Satu register, bukan dua modul

Kontrak, izin, dan sewa lahan punya pola yang sama: **dokumen + pihak + masa
berlaku + tindakan saat mendekati habis**. Satu entitas `LegalDocument` dengan
`jenis` lebih sederhana untuk admin (satu daftar, satu dasbor) dan untuk kode
(satu pengingat, satu penyimpanan).

| Jenis | Contoh | Pihak umum |
|---|---|---|
| `KONTRAK` | PKS mitra/reseller, kontrak pelanggan korporat, vendor, upstream bandwidth, NDA | Mitra, reseller, pelanggan, vendor, teks bebas |
| `IZIN` | NIB, izin penyelenggaraan ISP (Komdigi), izin tanam tiang/galian Pemda, PBG tower, PSE | Instansi penerbit (teks) |
| `SEWA_LAHAN` | Sewa lahan POP/tower, izin pemilik gedung | Pemilik lahan; dirujukkan ke site jaringan |
| `KORPORAT` | Akta pendirian/perubahan, notulen RUPS, surat kuasa | — (umumnya tanpa masa berlaku) |

**Kategori** dapat diatur tiap tenant, karena izin dan praktik tiap daerah
berbeda. Kategori bawaan saat modul diaktifkan:

| Jenis | Kategori bawaan |
|---|---|
| `KONTRAK` | PKS Reseller, PKS Mitra, Kontrak Pelanggan Korporat, Kontrak Vendor, Perjanjian Upstream/Bandwidth, NDA |
| `SEWA_LAHAN` | Sewa Lahan/Tower, Izin Pemilik Gedung |
| `IZIN` | NIB, Izin Penyelenggaraan (Komdigi), Izin Tiang/Galian Pemda, PBG, PSE |
| `KORPORAT` | Akta Perusahaan, Notulen RUPS, Surat Kuasa |

Tiap kategori punya **tingkat kerahasiaan**: `BIASA` (izin `legal:read`) atau
`RAHASIA` (izin tambahan `legal_rahasia:read`). Akta dan notulen RUPS bawaan
`RAHASIA`. Dokumen kategori rahasia tidak tampil sama sekali — di daftar, dasbor,
pencarian, maupun pengingat — bagi yang tidak memegang izinnya.

### 4.2 Data minimal

Wajib: judul, jenis, berkas (PDF/gambar). Sisanya opsional:

- nomor dokumen, kategori, penerbit/pihak (teks bebas **atau** tautan ke
  pelanggan/mitra/reseller/vendor/site)
- tanggal mulai, **tanggal berakhir**, nilai (Rp), catatan
- PIC (karyawan yang bertanggung jawab memperpanjang)
- tautan ke surat pengesahan bila ditandatangani lewat sistem

**Atribut legal** (opsional, untuk kontrak & sewa lahan) — dicatat sebagai hak,
kewajiban, dan tenggat, **bukan** data akuntansi:

- nilai, mata uang, skema pembayaran (sekali / bulanan / tahunan)
- jaminan (deposit, bank garansi) + tanggal pengembalian/berakhir jaminan
- **perpanjangan otomatis** (ya/tidak) dan **masa pemberitahuan** dalam hari
  (mis. 60 hari sebelum berakhir bila tidak ingin memperpanjang)
- **kewajiban berkala**: daftar `{deskripsi, tanggal jatuh tempo, berulang?}` —
  mis. bayar sewa tahunan, laporan ke Komdigi, perpanjangan bank garansi
- denda/penalti dan cara penyelesaian sengketa (pengadilan/arbitrase) — teks

### 4.3 Status — diturunkan, tidak diinput

Status dihitung dari tanggal, supaya tidak pernah basi karena lupa diubah:

- **Aktif** — tanpa tanggal berakhir, atau berakhir > 90 hari lagi
- **Segera berakhir** — berakhir ≤ 90 hari lagi
- **Kedaluwarsa** — tanggal berakhir sudah lewat dan belum diperpanjang
- **Diperpanjang** — sudah ada versi penggantinya
- **Diakhiri** — dihentikan manual (dengan alasan)

**Perpanjangan** membuat dokumen baru yang menautkan dokumen lama, jadi riwayat
versi kontrak/izin tetap utuh.

### 4.4 Pengingat

- Cron harian memindai **tenggat**: tanggal berakhir, batas pemberitahuan, jatuh
  tempo kewajiban berkala, dan berakhirnya jaminan.
- **Batas pemberitahuan** = tanggal berakhir − masa pemberitahuan. Untuk kontrak
  yang diperpanjang otomatis, inilah tenggat yang menentukan: lewat dari sini,
  kontrak terkunci satu periode lagi. Pengingatnya diprioritaskan di dasbor.
- Pengingat pada **H-90, H-30, H-7, dan H-0** tiap tenggat, plus mingguan selama
  kedaluwarsa dan belum diperpanjang.
- Penerima: PIC dokumen + pemegang izin `legal:update` di tenant.
- Kanal: notifikasi in-app + push (aplikasi mobile) + email. WhatsApp opsional,
  dan tenant tanpa WA tersambung dilewati tanpa error.
- Idempoten: satu pengingat per dokumen per ambang (aman bila cron berjalan ulang).

### 4.5 Halaman

- **Dasbor Legal** — kartu: segera berakhir (≤ 90 hari), kedaluwarsa, ditambahkan
  bulan ini; daftar "perlu tindakan" diurutkan dari yang paling mendesak.
- **Daftar dokumen** — filter jenis/kategori/status/pihak, pencarian.
- **Detail** — berkas, data, riwayat perpanjangan, tombol Perpanjang/Akhiri,
  "Kirim untuk ditandatangani" (→ pengesahan).
- **Tab Legal di halaman pihak** (opsional, ringan) — mis. detail mitra
  menampilkan PKS-nya beserta masa berlaku.

---

## 5. Fase 2 — Template dokumen

> **Sudah tersedia (2026-10-04):** sambungan Legal ↔ Pengesahan — dokumen legal PDF bisa
> dikirim untuk ditandatangani dan otomatis memakai PDF sah; surat sah bisa diarsipkan ke
> Legal. Template di bawah tinggal memakai jalur ini.

- **Format: editor di web**, bukan unggah Word. Format sengaja terbatas pada yang
  dipakai dokumen legal — judul, pasal bernomor, paragraf, tebal/miring, daftar,
  blok tanda tangan. Placeholder disisipkan lewat tombol (`{{mitra.nama}}`,
  `{{pelanggan.alamat}}`, `{{tanggal}}`, `{{nilai}}` …), tanpa mengetik sintaks.
- Alasan: admin yang merangkap tidak perlu paham placeholder Word; hasil seragam;
  PDF disusun dengan `pdf-lib` yang sudah dipakai pengesahan — tanpa LibreOffice
  di server (konversi .docx → PDF berat dan rawan di kontainer).
- **Kop surat** (logo, nama, alamat perusahaan) diatur sekali per tenant dan
  tercetak otomatis. Ada pratinjau PDF sebelum dikirim.
- Dokumen rumit buatan notaris/pihak luar tetap bisa diunggah sebagai PDF jadi.
- Disediakan template bawaan: PKS reseller, surat kuasa, kontrak pelanggan korporat.
- Alur: pilih template → pilih pihak → isian terisi otomatis, admin melengkapi →
  PDF dibuat → **dikirim ke pengesahan** → saat sah, PDF final otomatis tercatat
  di register sebagai `KONTRAK` dengan tautan ke surat pengesahannya.
- Format isi template perlu diputuskan (lihat §8).

---

## 6. Arsitektur

```
modules/legal/
├── domain/        # LegalDocument, jenis, aturan status & ambang pengingat (fungsi murni)
├── dto/
├── repositories/  # Prisma, isolasi tenant lewat ekstensi
├── services/      # LegalDocumentService, LegalReminderService, (Fase 2) LegalTemplateService
├── validators/    # Zod
└── index.ts
```

- **Feature flag**: entri `legal` di `lib/feature-modules.ts` (group `lainnya`);
  menu dan API digerbang `featureModule: "legal"`.
- **Izin**: `legal:read|create|update|delete` dan `legal_rahasia:read` untuk
  kategori rahasia — grup baru `LEGAL` di `lib/permission-config.ts`. Penyaringan
  kategori rahasia dilakukan di repository (seperti isolasi tenant), bukan di UI.
- **Penyimpanan**: berkas di R2 dengan prefix `legal/<tenant>/…`, disajikan lewat
  rute server (pola yang sama dengan pengesahan). Tanpa jalur disk lokal.
- **Antar-modul**: tautan ke pelanggan/mitra/vendor/site disimpan sebagai
  `(partyType, partyId)` dan di-resolve lewat public API modul masing-masing —
  tanpa foreign key lintas modul. Integrasi pengesahan lewat event
  `endorsement:endorsement.completed` (Fase 2).
- **Skema**: tabel baru `LegalDocument`, `LegalCategory` (dengan tingkat
  kerahasiaan), `LegalObligation` (kewajiban berkala), `LegalReminderLog`
  (idempotensi pengingat), (Fase 2) `LegalTemplate` dan kop surat di pengaturan
  tenant. Migration aditif.

---

## 7. Di luar lingkup

- Manajemen perkara/sengketa dan somasi otomatis dari tunggakan (Fase 3).
- Tanda tangan bersertifikat (PSrE, mis. Privy/VIDA). Pengesahan yang ada adalah
  tanda tangan elektronik sederhana dengan jejak audit dan sidik jari dokumen.
- OCR untuk membaca tanggal dari berkas yang diunggah.
- Akses untuk konsultan hukum eksternal.

---

## 8. Keputusan (2026-10-04)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Ambang pengingat | H-90/30/7/0 cukup, berlaku untuk semua tenggat |
| 2 | Kategori bawaan | PKS dan lainnya — daftar di §4.1; tenant bisa menambah |
| 3 | Format template | Editor web terbatas + kop surat tenant, PDF via pdf-lib; unggah PDF jadi tetap ada |
| 4 | Akses dokumen korporat | Dibedakan peran: kategori `RAHASIA` butuh `legal_rahasia:read` |
| 5 | Nilai kontrak | Dicatat sebagai atribut legal (hak, kewajiban, tenggat, masa pemberitahuan), bukan akuntansi; integrasi akuntansi bisa ditambah kelak |
