# Desain Modul Legal

**Tanggal**: 2026-10-04
**Status**: Draft — menunggu review
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

**Kategori** (mis. "Izin Pemda — Tiang", "PKS Reseller") dapat diatur tiap tenant,
karena izin dan praktik tiap daerah berbeda. Disediakan kategori bawaan saat
modul diaktifkan.

### 4.2 Data minimal

Wajib: judul, jenis, berkas (PDF/gambar). Sisanya opsional:

- nomor dokumen, kategori, penerbit/pihak (teks bebas **atau** tautan ke
  pelanggan/mitra/reseller/vendor/site)
- tanggal mulai, **tanggal berakhir**, nilai (Rp), catatan
- PIC (karyawan yang bertanggung jawab memperpanjang)
- tautan ke surat pengesahan bila ditandatangani lewat sistem

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

- Cron harian memindai dokumen dengan tanggal berakhir.
- Pengingat pada **H-90, H-30, H-7, dan H-0**, plus mingguan selama kedaluwarsa
  dan belum diperpanjang.
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

- Template per tenant: judul, isi dengan placeholder (`{{mitra.nama}}`,
  `{{pelanggan.alamat}}`, `{{tanggal}}`, `{{nilai}}` …).
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
- **Izin**: `legal:read|create|update|delete` — grup baru `LEGAL` di
  `lib/permission-config.ts`.
- **Penyimpanan**: berkas di R2 dengan prefix `legal/<tenant>/…`, disajikan lewat
  rute server (pola yang sama dengan pengesahan). Tanpa jalur disk lokal.
- **Antar-modul**: tautan ke pelanggan/mitra/vendor/site disimpan sebagai
  `(partyType, partyId)` dan di-resolve lewat public API modul masing-masing —
  tanpa foreign key lintas modul. Integrasi pengesahan lewat event
  `endorsement:endorsement.completed` (Fase 2).
- **Skema**: tabel baru `LegalDocument`, `LegalCategory`, `LegalReminderLog`
  (idempotensi pengingat), (Fase 2) `LegalTemplate`. Migration aditif.

---

## 7. Di luar lingkup

- Manajemen perkara/sengketa dan somasi otomatis dari tunggakan (Fase 3).
- Tanda tangan bersertifikat (PSrE, mis. Privy/VIDA). Pengesahan yang ada adalah
  tanda tangan elektronik sederhana dengan jejak audit dan sidik jari dokumen.
- OCR untuk membaca tanggal dari berkas yang diunggah.
- Akses untuk konsultan hukum eksternal.

---

## 8. Pertanyaan terbuka

1. **Ambang pengingat**: apakah H-90/30/7/0 cocok, atau perlu bisa diatur per
   kategori (izin Pemda sering butuh waktu proses lebih lama)?
2. **Kategori bawaan**: daftar izin apa yang umum di semua tenant ISP, dan mana
   yang biarkan tenant menambah sendiri?
3. **Format template (Fase 2)**: editor teks kaya di web → PDF, atau unggah
   template `.docx` dengan placeholder?
4. **Akses berkas**: apakah dokumen korporat (akta, RUPS) perlu izin terpisah yang
   lebih ketat daripada kontrak biasa?
5. **Nilai kontrak**: perlu disambungkan ke akuntansi (mis. beban sewa lahan
   berulang), atau cukup dicatat sebagai informasi?
