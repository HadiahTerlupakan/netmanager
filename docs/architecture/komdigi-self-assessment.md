# Self-Assessment Komdigi — Laporan Mandiri Standar Mutu Layanan

> Status: **Tahap 1 tersedia (2026-10-04)** — menu *Self-Assessment Komdigi* (`/admin/regulasi/self-assessment`), izin `regulasi:read`.

## Latar

Komdigi meminta ISP melaporkan capaian standar mutu layanan per tahun beserta
Lampiran I (data sampel per parameter, baris TOTAL & CAPAIAN) dan agregasi
statistik tertimbang `S = Σ(Ni × Si) / Σ(Ni)` (bulanan → kuartal → tahunan).
Nilai tahunan dipindahkan ke dokumen Word "Berdasarkan Self Assessment".

## Parameter & status

| Kelompok | Parameter | Standar | Sumber data | Status |
|---|---|---|---|---|
| Non-network | Pasang baru | ≥ 90% ≤ 7 hari kalender sejak disetujui (Perdirjen 7/2024) | Work order `INSTALLATION` | ✅ Tahap 1 |
| Non-network | Pemulihan layanan | ≥ 90% ≤ 2 hari kerja (Perdirjen 7/2024) | Work order `TROUBLESHOOT` | ✅ Tahap 1 |
| Non-network | Keluhan pelanggan | ≥ 90% ≤ 3 hari kerja (Perdirjen 7/2024) | Tiket berkategori Komdigi | ⏳ Tahap 2 |
| Network | Availability per PoP | ≥ 99% (Perdirjen 1/2021) | Riwayat naik/turun perangkat per site | ⏳ Tahap 3 |
| Network | Packet loss | ≤ 5% (Perdirjen 1/2021) | Prober ping berkala, ≥ 100 sampel/kab-kota | ⏳ Tahap 3 |
| Network | Latency ≤ 250 ms | ≥ 90% (Perdirjen 1/2021) | Prober ping berkala | ⏳ Tahap 3 |

## Keputusan metode (Tahap 1)

- **Pasang baru** dihitung sejak *disetujui* sampai *selesai* (versi file contoh,
  bukan versi template "pengajuan → persetujuan"). Waktu disetujui =
  `WorkOrders.approvedAt`, atau `createdAt` bila kosong (di produksi `approvedAt`
  instalasi selalu kosong).
- **Hari kalender** = selisih tanggal WIB; **hari kerja** = Senin–Jumat di luar
  `Holiday` tenant, dihitung setelah tanggal mulai s.d. tanggal selesai
  (hari yang sama = 0; Kamis → Senin = 2) — cocok dengan contoh Komdigi.
- Permohonan **belum selesai**: bila sudah melewati batas → *tidak memenuhi*;
  bila masih dalam batas → *belum dinilai* (tidak masuk N).
- Work order **dibatalkan** tidak dihitung. Bulan pengelompokan = bulan awal
  hitungan (WIB).
- **Wilayah** = `Sites.kabupatenKota` (kolom baru); site kosong/tanpa site
  dikelompokkan terpisah dan diperingatkan di halaman.

## Arsitektur

```
modules/regulatory/
├── domain/        # wib-calendar, service-level-standards/evaluation/aggregation (murni), ports
├── services/      # SelfAssessmentReportService, SelfAssessmentWorkbook (exceljs), adapter sumber data
├── dto/           # ringkasan untuk halaman (sampel lengkap hanya di Excel)
└── validators/
```

Sumber data lewat API publik modul lain: `WorkOrderServiceLevelQueryService`
(work-order), `HolidayLookupService.listHolidayDates` (attendance),
`SiteService.getSites` (roles). API: `GET /api/admin/regulatory/self-assessment?year=`
(JSON) dan `/export?year=` (xlsx: *Lampiran I*, *Agregasi*, *Catatan*).

## Dokumen Word (format Komdigi)

Tombol **Dokumen Word** membuka formulir: profil penyelenggara (nama, jenis izin,
alamat, nomor/tanggal/link izin, kota, Direktur Utama — tersimpan untuk tahun
berikutnya; nama & alamat awal dari Pengaturan Umum), capaian manual untuk
parameter yang belum dihitung sistem, dan link dokumen pendukung per parameter.
Hasilnya template Word Komdigi asli yang terisi (`modules/regulatory/templates/self-assessment-komdigi.docx`,
diisi dengan `docxtemplater`): formulir pelaporan + surat hasil pengukuran
(kop, tabel pencapaian, tempat/tanggal, Direktur Utama; kotak materai tetap).

- Template = berkas asli dari Komdigi yang sel kosongnya diberi penanda `{kunci}`
  tanpa mengubah teks/format. Bila Komdigi merilis format baru, ganti berkas ini
  dan sesuaikan penandanya (daftar kunci di `buildDocumentValues`).
- Profil & isian per tahun disimpan di pengaturan tenant (`REGULASI_*`,
  `REGULASI_SELF_ASSESSMENT_<tahun>`) — tanpa tabel baru. Menyimpan butuh
  `regulasi:update`.
- Kop memuat nama (kapital) + alamat · telepon · email; logo belum disisipkan.

## Tahap berikutnya

- **Tahap 2 — keluhan:** kategori tiket sesuai jenis keluhan Komdigi (tagihan tidak
  akurat, aktivasi terlambat, pelayanan tidak profesional, lainnya) + pencatatan.
- **Tahap 3 — jaringan:** tabel transisi status perangkat per site (availability) dan
  prober ICMP terjadwal yang menyimpan sampel (waktu kirim/terima, RTT, sukses).
  Data hanya terkumpul sejak diaktifkan — tidak bisa mundur.
