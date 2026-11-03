# Review Draft PKS Jual Kembali Jasa Layanan Akses Internet

Tanggal: 3 November 2026. Berkas yang direview: `~/Downloads/Draft PKS Jual Kembali Jasa Telekomunikasi.doc`
(15 halaman, dibuat 19 Jan 2022, terakhir disimpan 20 Jan 2022). Acuan: kajian
`docs/reports/REGULASI_RESELLER_KOMDIGI_2026-11-03.md`. Ini bukan nasihat hukum; finalisasi tetap
lewat konsultan hukum.

## 1. Model bisnis di draft vs model di sistem

Draft memakai model **grosir**: PIHAK KESATU (ISP) menjual bandwidth/paket ke PIHAK KEDUA (reseller),
PIHAK KEDUA menjual kembali dan menagih pelanggan, lalu membayar ISP biaya paket + biaya
administrasi bulanan sebesar persentase pendapatan kotor reseller (Pasal 5).

Sistem NetManager saat ini memakai model **agen**: ISP sendiri yang menagih pelanggan reseller dan
reseller menerima komisi.

Kedua model bisa sah, asalkan memenuhi Permenkominfo 5/2021 Pasal 223 ayat (2) huruf b angka 3:
"seluruh pendapatan ... menjadi pendapatan dari dan dibukukan oleh" ISP. Untuk model grosir artinya
seluruh pendapatan dari pelanggan akhir yang dilaporkan reseller dibukukan di buku ISP, dan menjadi
basis BHP/USO ISP. Draft belum menyatakan hal itu dengan tegas (lihat 2.1).

## 2. Klausul wajib regulasi

| Kewajiban (PM 5/2021 Ps 223(2)) | Di draft | Status |
|---|---|---|
| a. Reseller memenuhi standar usaha jual kembali (NIB + sertifikat standar KBLI jual kembali) | Premis huruf (D) menyebut NIB | Sebagian — tidak menyebut KBLI/sertifikat standar, tidak ada kewajiban menjaga izin tetap berlaku, tidak ada hak memutus bila izin reseller dicabut |
| b.1 Merek ISP, boleh ditambah merek reseller | Ps 4(2)b.2, Ps 11 | Ada — co-branding belum diatur (boleh, opsional) |
| b.2 Reseller memenuhi standar kualitas yang dikomitmenkan ISP | — | **Tidak ada.** Ps 7 hanya SLA ISP → reseller, bukan kewajiban reseller ke pelanggan |
| b.3 Seluruh pendapatan menjadi pendapatan dan dibukukan oleh ISP | Ps 4(1)a.4 (ISP menerima laporan), Ps 4(2)b.8 | **Bertentangan** — 4(2)b.8 berbunyi PIHAK KEDUA "membukukan" pendapatan; Ps 5(5)-(6) memperlakukannya sebagai pendapatan kotor reseller |
| b.4 Tagihan ke pelanggan mencantumkan merek ISP | Ps 11(2)b | Ada |
| b.5 Layanan berbasis IP memakai IP publik dan ASN milik ISP | Ps 4(1)b.3, 4(2)a.5 | Sebagian — kalimat "mengalokasikan ASN ... untuk PIHAK KEDUA" ambigu; perlu tegas bahwa ASN dan IP tetap milik ISP dan reseller tidak boleh memakai ASN/IP sendiri |
| c. ISP menjamin keberlangsungan layanan | Ps 15(2)-(4) | **Bertentangan sebagian** — Ps 15(1) membebaskan ISP dari tanggung jawab ke pelanggan saat pemutusan permanen |
| d. Perlindungan konsumen | Ps 4(2)b.10 (formulir berlangganan saja) | **Tidak ada** — penanganan keluhan pelanggan akhir, informasi tarif, standar kontrak berlangganan |

### 2.1 Usulan perbaikan klausul wajib

1. **Ps 4(2)b.8 dan Ps 5(5)-(6):** ganti menjadi: seluruh pendapatan dari Pelanggan atas jual kembali
   merupakan pendapatan PIHAK KESATU dan dibukukan oleh PIHAK KESATU; PIHAK KEDUA wajib melaporkan
   rincian pendapatan per pelanggan setiap bulan paling lambat tanggal __; PIHAK KESATU berhak
   memeriksa. Imbalan PIHAK KEDUA dinyatakan sebagai komisi/selisih yang diatur di Lampiran.
2. **Kewajiban baru PIHAK KEDUA:** memenuhi standar kualitas layanan yang dikomitmenkan PIHAK KESATU
   kepada Pelanggan (rujuk Lampiran SLA pelanggan).
3. **Ps 15(1):** hapus atau ubah: bila terjadi Isolir/Pemutusan terhadap PIHAK KEDUA, PIHAK KESATU
   menjamin keberlangsungan layanan bagi Pelanggan (pengambilalihan langsung atau pengalihan),
   sejalan dengan Ps 223(2)c.
4. **Pasal baru Perlindungan Konsumen:** kanal pengaduan pelanggan akhir (PIHAK KEDUA lini pertama,
   eskalasi ke PIHAK KESATU), batas waktu penanganan, informasi tarif yang jelas, formulir
   berlangganan memakai syarat & ketentuan PIHAK KESATU.
5. **Perizinan PIHAK KEDUA:** sebut NIB + KBLI jual kembali yang berlaku di OSS (KBLI 2020: 61994;
   cek padanannya di KBLI 2025) dan sertifikat standar; kewajiban menjaga tetap berlaku dan
   melapor bila berubah; tambah alasan pemutusan di Ps 14(1): izin PIHAK KEDUA dicabut/tidak berlaku.
6. **ASN/IP:** ASN dan IP publik tetap milik PIHAK KESATU; PIHAK KEDUA dilarang memakai ASN/IP sendiri
   atau dari pihak lain untuk layanan ini.

## 3. Hal penting lain

- **Larangan sub-reseller** tegas (selain Ps 14(1)c tentang pemindahtanganan).
- **Pelindungan data pribadi (UU 27/2022):** atur peran pengendali/prosesor, keamanan data, notifikasi
  kebocoran. Ps 8 hanya mengatur retensi.
- **Dasar hukum** di premis: PP 46/2021, Permenkominfo 5/2021, Permenkomdigi 15/2025 (standar KBLI
  jual kembali), UU 36/1999 jo. UU 6/2023.
- **Ps 5(6) "PPnDn":** istilah lama; gunakan PPN. BHP/USO adalah kewajiban ISP atas pendapatan
  kotornya — bila dibebankan ke reseller sebagai bagian biaya administrasi, nyatakan sebagai
  komponen komersial, bukan pemindahan kewajiban.
- **Ps 6(1):** "3 kali Surat Peringatan" tetapi isolir "sampai Surat Peringatan ke-2" — tidak konsisten.
- **Ps 14(1) huruf a–d** membolehkan "PARA PIHAK" memutus, padahal semuanya pelanggaran PIHAK KEDUA;
  tambah alasan pelanggaran PIHAK KESATU. Ps 14(1)f berakhiran "dan/atau" tanpa huruf berikutnya.

## 4. Kesalahan redaksi

- Premis: "milik PIHAK PERTAMA" (seharusnya PIHAK KESATU); "sebagaimana dalam huruf C" padahal
  premis tidak berhuruf; "Kementiran"; "Sebagaimaa"; "terselanggarannya".
- Pembukaan: "tahun Dua Ribu Dua Puluh" (tidak lengkap); "Menteri Kehakiman" (seharusnya Menteri
  Hukum dan HAM / Menteri Hukum).
- Ps 4(2)b: nomor lompat dari 5) ke 7); "FPP" dipakai tanpa definisi.
- Ps 5(3): "satua/paket"; Ps 6(5): "Isoliir", "namnun"; Ps 7(5): "ebagai"; Ps 10(2): huruf "B" kapital;
  Ps 10(4): "Force Meajure".
- Ps 9: ada dua ayat (2); Ps 14: ayat (4) tidak ada; Ps 16(2): kosong; Pasal 16 judul "PELAKASANAAN".
- **Catatan kaki halaman terakhir menyebut "Bitsnet"** ("Pasal ini Opsional jika Bitsnet bersedia
  memberikan restitusi") — sisa dari dokumen pihak lain; hapus sebelum dipakai.

## 5. Dampak ke sistem

Bila model grosir (draft) yang dipakai, sistem perlu: laporan pendapatan bulanan per reseller
(diisi/diunggah reseller atau dihitung dari pelanggan reseller), tagihan ISP ke reseller (paket +
biaya administrasi % pendapatan kotor), pencatatan pendapatan pelanggan reseller di buku ISP dan basis
BHP/USO, serta `ResellerPackagePrice` sebagai harga paket ke reseller. Bila model agen (sistem
sekarang) yang dipakai, draft perlu ditulis ulang di Pasal 4–5 agar ISP yang menagih pelanggan dan
reseller menerima komisi.
