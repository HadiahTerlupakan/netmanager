# Kajian Regulasi Reseller Jasa Akses Internet dan Kepatuhan Modul Reseller NetManager

Status per 3 November 2026. Bukti kode diambil dari working tree saat ini, termasuk perubahan reseller yang belum di-commit. Kajian ini hanya membaca kode, tidak ada yang diubah. Ini bukan nasihat hukum.

## 1. Ringkasan regulasi

1. **Reseller legal, tapi bersyarat.** "Jual Kembali Jasa Telekomunikasi" didefinisikan resmi dan boleh untuk jasa multimedia, termasuk layanan akses internet. Pelaksanaannya berdasarkan pola kerja sama antara penyelenggara jasa dan pelaksana jual kembali.
   - Dasar: PP 46/2021 Pasal 31 ayat (1), (4), (5); Permenkominfo 5/2021 Pasal 1 angka 88.
   - Sumber: https://jdih.komdigi.go.id/produk_hukum/view/id/762/t/peraturan+pemerintah+nomor+46+tahun+2021 dan https://jdih.komdigi.go.id/produk_hukum/view/id/768/t/peraturan+menteri+komunikasi+dan+informatika+nomor+5+tahun+2021
   - Definisi saja tidak memberi izin. Kegiatan ini tetap harus memenuhi perizinan dan perjanjian kerja sama.

2. **Reseller wajib punya perizinan berusaha sendiri.** Kewajiban ini berbunyi "memenuhi standar usaha aktivitas Jasa Jual Kembali Jasa Telekomunikasi".
   - Dasar: Permenkominfo 5/2021 Pasal 223 ayat (2) huruf a.
   - Standar usaha terbaru ada di Permenkomdigi 15/2025, Lampiran standar KBLI 61994. Ruang lingkupnya memuat "jasa jual kembali akses internet", dan jual kembali didefinisikan "melalui kerja sama". Aturan ini mencabut Permenkominfo 3/2021. Sumber: https://peraturan.bpk.go.id/Download/397370/Permenkomdigi%2015%20tahun%202025.pdf
   - Kode KBLI kemungkinan berubah: di KBLI 2025, 61994 dipetakan ke 61201. Belum dicek di OSS.

3. **Perjanjian kerja sama (PKS) antara ISP dan reseller wajib memuat lima hal.**
   - Dasar: Permenkominfo 5/2021 Pasal 223 ayat (2) huruf b angka 1–5. Isinya sejalan dengan Permenkomdigi 15/2025 Lampiran KBLI 61994 angka 6 huruf b.
   - Lima isinya:
     1. Reseller memakai merek dagang ISP dan boleh menambahkan mereknya sendiri (co-branding).
     2. Reseller memenuhi standar kualitas yang dikomitmenkan ISP.
     3. "Seluruh pendapatan ... menjadi pendapatan dari dan dibukukan oleh" ISP.
     4. Tagihan (billing) mencantumkan merek dagang ISP.
     5. Untuk layanan berbasis IP, reseller memakai IP publik dan ASN milik ISP.
   - Pasal ini tidak menyebut kata "tertulis". Namun PM 13/2019 Pasal 22 ayat (1) mensyaratkan PKS tertulis, dan petugas di lapangan mencari dokumennya, jadi dalam praktik PKS harus tertulis.

4. **Pembagian kewajiban ISP dan reseller.**
   - ISP wajib menjamin keberlangsungan seluruh layanannya (Pasal 223 ayat (2) huruf c).
   - "Menjamin perlindungan konsumen" (huruf d) tidak menyebut subjek. Huruf ini ada di daftar kewajiban pelaku usaha jual kembali, jadi paling aman dibaca sebagai kewajiban reseller. Tingkat keyakinan sedang.
   - Kewajiban kualitas layanan, termasuk penanganan keluhan (PP 46/2021 Pasal 14 dan Penjelasannya), serta publikasi dan pelaporan kualitas (PM 5/2021 Pasal 222 angka 8–10 dan 13) melekat pada ISP sebagai pemegang izin. Bahwa keluhan pelanggan reseller ikut menjadi tanggung jawab ISP adalah tafsiran, bukan bunyi pasal.

5. **Aturan lama yang masih berlaku berdampingan.** Permenkominfo 13/2019 Pasal 22 berisi syarat yang sama. Menurut JDIH BPK statusnya masih "Berlaku" (diubah oleh PM 2/2020, 1/2021, dan 14/2021). Warnet dan wartel dikecualikan dari seluruh syarat ayat (3).
   - Sumber: https://peraturan.bpk.go.id/Details/203113/permenkominfo-no-13-tahun-2019

6. **Sanksi administratif.**
   - Pelanggaran Pasal 222–223 dikenai sanksi administratif, dan ini berlaku juga bagi pelaku jual kembali (Pasal 225 ayat (1) dan (2) huruf d).
   - Bentuknya: teguran tertulis, denda, penghentian sementara, pemutusan akses, daya paksa polisional, pencabutan layanan, dan pencabutan izin (Pasal 225 ayat (3)).
   - Pelaku yang belum berizin lebih dulu menerima surat perintah penghentian (Pasal 225 ayat (5)).
   - Pemutusan akses bisa berupa pemutusan link, total shutdown, atau pembongkaran perangkat, dan berlaku sampai kewajiban dipenuhi (Pasal 233).
   - Proses pidana tidak menggugurkan sanksi administratif (Pasal 226 ayat (2)).

7. **Sanksi pidana.** Menyelenggarakan telekomunikasi tanpa Perizinan Berusaha diancam penjara paling lama 10 tahun dan/atau denda paling banyak Rp1,5 miliar.
   - Dasar: UU 36/1999 Pasal 47 jo. Pasal 11 ayat (1), sebagaimana diubah UU Cipta Kerja (kini UU 6/2023).
   - Angka "6 tahun" yang muncul di beberapa portal berasal dari teks asli sebelum diubah.
   - Ada kemungkinan denda ini kini dibaca dalam sistem kategori KUHP baru. Belum diverifikasi.

8. **Penegakan di lapangan nyata dan sedang berjalan.**
   - Penertiban DJED Komdigi 5–9 Mei 2025: dari 25 operator, 11 patuh, 8 tidak punya PKS dengan ISP, 4 menyalahgunakan alokasi bandwidth, dan 2 kabur. Operator tanpa izin atau tanpa dokumen kerja sama perangkatnya disegel. Sumber: https://djed.komdigi.go.id/news/penertiban-nasional-terhadap-penyelenggaraan-telekomunikasi-yang-belum-memenuhi-perizinan-berusaha
   - Tahun 2024: 111 pelaku dilaporkan, 51 diputus aksesnya, 60 ternyata reseller resmi. Sumber: ANTARA 8 Okt 2024.
   - Pada 12 April 2026, Direktorat Pengendalian Ekosistem Digital menyatakan akan "menindak tegas reseller ISP yang belum memenuhi ketentuan".

9. **BHP dan USO.**
   - BHP Telekomunikasi 0,50% dan KPU/USO 1,25% dari Pendapatan Kotor, dihitung sendiri (Pasal 188 dan 190). Bila laporan keuangan tidak diaudit KAP, boleh memakai laporan yang ditandatangani direksi (Pasal 190 ayat (2)).
   - Pengurang hanya piutang yang nyata-nyata tak tertagih dan biaya interkoneksi (Pasal 194). Pengecualian non-telekomunikasi ada di Pasal 192.
   - Dilarang memindahkan pendapatan telekomunikasi menjadi non-telekomunikasi (Pasal 193 ayat (2)).
   - Komisi reseller tidak disebut sebagai pengurang. Jadi basis BHP/USO adalah tagihan bruto, dan komisi dicatat sebagai beban. Ini tafsiran yang konsisten dengan pasalnya, bukan bunyi eksplisit.

10. **Konsekuensi untuk desain sistem.** Model yang sesuai adalah: ISP menagih pelanggan atas merek ISP, pendapatan dibukukan ISP, dan reseller menerima komisi atau settlement. Model "reseller membeli grosir lalu menjual dengan margin sendiri" tidak sejalan dengan Pasal 223 ayat (2) huruf b angka 3. Ini kesimpulan dari pasal tersebut, bukan larangan yang tertulis eksplisit.

## 2. Tabel kepatuhan sistem

Keterangan kolom: **W** = wajib menurut regulasi, **PB** = praktik baik atau tafsiran.

| # | Kewajiban | Sifat | Status | Bukti (file:line) | Perubahan yang disarankan |
|---|---|---|---|---|---|
| 1 | Tagihan diterbitkan dan pendapatan dibukukan oleh ISP (Pasal 223(2)b.3) | W | **Sudah** | `modules/finance/services/BillingInvoiceCreationService.ts:52,186`: invoice tenant memakai `hargaPaket.harga`. Reseller hanya relasi di `Pelanggan.resellerId/resellerOutletId` (`prisma/schema.prisma:987-988`). | Pertahankan. Tolak di level desain setiap alur "reseller menagih sendiri". |
| 2 | Imbalan reseller berupa komisi, bukan pengurang pendapatan | W (prinsip) / PB (perlakuan akuntansi) | **Sebagian** | Komisi diakru saat invoice lunas di `modules/reseller/services/ResellerCommissionService.ts:55-104`. Tidak ada jurnal beban komisi: `grep` "commission" di `modules/accounting` hasilnya kosong. | Tambahkan jurnal akrual Dr Beban Komisi Reseller / Cr Utang Komisi, lalu saat bayar Dr Utang / Cr Kas. Jalankan lewat event `ResellerSettlement` ke modul accounting. |
| 3 | Basis BHP/USO bruto, komisi tidak dikurangkan (Pasal 188, 194) | W | **Sudah, dengan catatan** | `modules/tax/services/BhpUsoService.ts:185-196` menjumlahkan semua kredit akun REVENUE. | Pastikan beban komisi tidak pernah diposting sebagai debit akun REVENUE. Di luar soal reseller: pengecualian Pasal 192 (misalnya penjualan perangkat) dan pembalikan debit belum diperhitungkan. |
| 4 | Billing mencantumkan merek ISP (Pasal 223(2)b.4) | W | **Sudah secara implisit, perlu verifikasi** | Branding per tenant di `modules/settings/services/appBranding.ts:11-26`. Invoice selalu milik tenant. Template PDF dan WA tidak saya periksa satu per satu. | Pastikan setiap invoice, struk outlet, dan notifikasi memuat nama atau merek ISP. Jika ada struk dari outlet, wajibkan merek ISP. |
| 5 | Co-branding reseller | PB (boleh, tidak wajib) | **Belum** | Model `Reseller` (`schema.prisma:1049-1074`) tidak punya field merek. | Opsional: field `brandName`. Tampilkan sebagai merek tambahan, merek ISP tetap utama. |
| 6 | Reseller memenuhi standar usaha dan perizinan (NIB, Sertifikat Standar KBLI jual kembali) (Pasal 223(2)a) | W (kewajiban reseller; ISP berkepentingan memverifikasi) | **Belum** | `Reseller` hanya berisi code, name, email, phone, address, status, notes (`schema.prisma:1049-1062`). Validator di `modules/reseller/validators/reseller.ts:14-22`. | Tambahkan `legalName`, `nib`, `kbliCode`, `standardCertificateNumber`, `licenseVerifiedAt`. Validasi Zod. Status ACTIVE hanya bisa dipasang bila data izin terisi (bisa dibuat konfigurasi per tenant). |
| 7 | PKS ISP–reseller ada dan masih berlaku (Pasal 223(2)b; PM 13/2019 Pasal 22(1)) | W | **Sebagian** | Modul legal mendukung dokumen dengan `partyType RESELLER`, `startDate`/`endDate`, dan pengingat (`schema.prisma:6646-6652`, `LegalReminderLog` 6715). Ada kategori "PKS Reseller" (`modules/legal/domain/default-categories.ts:15`). Tidak ada keterkaitan wajib ke status reseller. | Tampilkan status PKS (ada/aktif/kedaluwarsa) di daftar reseller. Blokir aktivasi reseller atau penambahan pelanggan baru bila PKS aktif tidak ada. Beri peringatan menjelang PKS berakhir. |
| 8 | Isi PKS memuat lima klausul wajib, ditambah keberlangsungan layanan dan perlindungan konsumen | W (isi PKS) | **Belum** | Template "PKS Reseller" di `modules/legal/domain/default-templates.ts:36-67` hanya memuat ruang lingkup, jangka waktu, hak/kewajiban generik, dan sengketa. | Tambahkan pasal-pasal: merek ISP dan co-branding; standar kualitas layanan; seluruh pendapatan dibukukan ISP; billing bermerek ISP; IP publik/ASN milik ISP; keberlangsungan layanan oleh ISP; perlindungan konsumen dan penanganan keluhan; kewajiban izin reseller (NIB/KBLI); syarat pemutusan; larangan sub-reseller (opsional). Template harus diperiksa konsultan hukum. |
| 9 | IP publik dan ASN milik ISP (Pasal 223(2)b.5) | W | **Sudah secara implisit** | Pelanggan reseller adalah `Pelanggan` PPPoE di jaringan tenant (`schema.prisma:918` dst.), jadi IP-nya dari ISP. | Bila reseller mengoperasikan segmen jaringan sendiri (RT/RW Net bermitra), catat blok IP yang dialokasikan ISP ke reseller (PB). |
| 10 | Kualitas layanan dan keluhan pelanggan reseller dihitung dalam KPI ISP (PP 46/2021 Pasal 14; PM 5/2021 Pasal 222) | W bagi ISP; cakupan pelanggan reseller adalah tafsiran | **Sudah** | Self-assessment di `modules/regulatory/services/complaint-source-adapters.ts:15,98` menghitung semua pelanggan dan tiket tanpa memisahkan reseller. | PB: tambahkan rincian KPI per reseller untuk pengawasan kualitas mitra. |
| 11 | Pendapatan reseller dicatat terpisah dan dilaporkan ke ISP | PB (wajib di PM 3/2021 yang sudah dicabut; masih ada di panduan DJED 2025) | **Sebagian** | `ResellerCommission.baseAmount` per invoice (`schema.prisma:1150-1185`) dan `getSummary` di `ResellerCommissionService.ts:177-184`. Tidak ada laporan omzet per reseller atau outlet. | Laporan bulanan per reseller/outlet: jumlah pelanggan, tagihan bruto, terbayar, komisi. Bisa diekspor untuk lampiran PKS dan untuk ditunjukkan saat pemeriksaan. |
| 12 | Komisi benar-benar terbit | Fungsional (prasyarat butir 2) | **Belum berfungsi** | Accrual butuh `ResellerCommissionRule` (`ResellerCommissionRepository.ts:59-76`), tetapi tidak ada endpoint atau service yang membuat rule. `grep resellerCommissionRule.create` hasilnya kosong. Validator hanya untuk list dan settlement (`validators/reseller-commission.ts:32-49`). | CRUD aturan komisi: API, validator, dan UI. |
| 13 | Siklus settlement (approve dan bayar) tercatat | PB (pembuktian imbalan reseller) | **Sebagian** | Enum `PENDING/APPROVED/PAID` (`schema.prisma:6333-6337`), tetapi route settlement hanya GET/POST (`app/api/admin/resellers/[id]/settlements/route.ts:25,56`). | Endpoint approve dan mark-paid, plus jurnal (butir 2). |
| 14 | Pemutusan atau suspend kemitraan bila reseller melanggar | PB (panduan Kominfo 2024; sanksi Pasal 225) | **Sebagian** | `INACTIVE` hanya menolak penugasan pelanggan baru (`ResellerCustomerRelationService.ts:50-54`). Akrual komisi tidak memeriksa status reseller (`ResellerCommissionService.ts:62-82`). | Status `SUSPENDED`/`TERMINATED` dengan alasan dan tanggal. Hentikan akrual komisi saat suspend. Jejak audit. |
| 15 | Harga atau tarif ke pelanggan disosialisasikan dengan jelas; promo di bawah biaya pokok kurang dari 1 tahun (Pasal 78–79) | W bagi ISP atas tarif ke pelanggan; penerapan ke harga reseller adalah tafsiran | **Tidak berlaku saat ini (fitur mati)** | `ResellerPackagePrice` dan `resolvePackagePrice` (`ResellerPricingService.ts:64-95`) tidak dipanggil di luar modul. Invoice tetap memakai `hargaPaket.harga` (`BillingInvoiceCreationService.ts:52`). Hanya `endsAt > startsAt` yang divalidasi (`validators/reseller-pricing.ts:3-16`). | Tentukan maksud fitur ini. (a) Jika harga khusus ke pelanggan akhir: sambungkan ke penagihan, wajibkan `endsAt`, tampilkan di portal pelanggan. (b) Jika harga grosir: hapus, karena tidak sejalan dengan model "pendapatan dibukukan ISP". (c) Jika tidak dipakai: hapus. |
| 16 | Klausul larangan jual kembali tanpa izin di perjanjian berlangganan pelanggan | PB (imbauan Kominfo Okt 2024, bukan pasal) | **Belum diperiksa** | Tidak saya temukan di template legal. Syarat registrasi tidak saya cek. | Tambahkan ke syarat dan ketentuan berlangganan atau template kontrak pelanggan. |
| 17 | Larangan sub-reseller dan harga ditetapkan ISP | PB (ada di PM 3/2021 yang sudah dicabut; tidak tertulis di 15/2025) | **Sesuai secara struktur** | Hierarki hanya reseller → outlet (`schema.prisma:1076-1097`), tanpa sub-reseller. | Atur di PKS. Tidak perlu perubahan sistem. |
| 18 | Dasar komisi | PB (bisnis, bukan regulasi) | Catatan | Payload `amount` adalah "total tagihan (setelah saldo kredit)" (`lib/event-bus/types.ts:234`), jadi kemungkinan termasuk PPN. Komisi persentase dihitung dari angka ini (`ResellerCommissionService.ts:84-87`). | Pertimbangkan dasar komisi dari DPP (tanpa PPN) dan tuangkan di PKS. |

## 3. Rekomendasi perubahan, diurutkan prioritas

1. **Data izin reseller dan pengecekan PKS (Pasal 223(2)a dan b; PM 13/2019 Pasal 22(1)).**
   - Apa: field `legalName`, `nib`, `kbliCode`, `standardCertificateNumber`, `licenseVerifiedAt` di `Reseller`. Tautan ke `LegalDocument` PKS yang aktif. Reseller hanya bisa ACTIVE atau menerima pelanggan baru bila izin dan PKS aktif ada.
   - Kenapa: PKS dan izin adalah hal pertama yang diperiksa petugas (penertiban 2025: 8 dari 25 operator tanpa PKS, perangkatnya disegel).
   - Dampak: reseller lama perlu dilengkapi datanya. Sediakan masa transisi berupa peringatan dulu, baru diblokir.
   - Migration: **ya**, misalnya `add_license_fields_to_resellers`. Kolomnya nullable, tidak destruktif.

2. **Template PKS Reseller memuat klausul wajib (Pasal 223(2)b angka 1–5, huruf c dan d).**
   - Apa: revisi `modules/legal/domain/default-templates.ts:36-67`. Klausul yang perlu ditambahkan ada di tabel butir 8.
   - Kenapa: isi PKS diatur pasal, dan template yang ada sekarang terlalu generik.
   - Dampak: template baru hanya untuk tenant baru atau via opsi reset. Template milik tenant yang sudah ada jangan ditimpa.
   - Migration: **tidak**, ini data seed/kode.

3. **CRUD aturan komisi (prasyarat agar model komisi berjalan).**
   - Apa: API, validator Zod, dan UI untuk `ResellerCommissionRule`.
   - Kenapa: tanpa rule, komisi tidak pernah terbit, sehingga imbalan reseller terjadi di luar sistem dan tidak terdokumentasi sebagai komisi.
   - Dampak: fitur baru di `/admin/resellers`.
   - Migration: **tidak**, tabelnya sudah ada.

4. **Jurnal akuntansi komisi dan settlement, plus endpoint approve/pay.**
   - Apa: akrual dicatat Dr Beban Komisi Reseller / Cr Utang Komisi Reseller; pembayaran dicatat Dr Utang / Cr Kas/Bank. Pengiriman lewat domain event ke modul accounting.
   - Kenapa: pendapatan harus dibukukan bruto oleh ISP (Pasal 223(2)b.3), dan komisi tidak boleh mengurangi basis BHP/USO (Pasal 193(2), 194). Perlakuan sebagai beban adalah inferensi akuntansi yang perlu dikonfirmasi akuntan.
   - Dampak: COA tenant perlu akun baru. Handler event harus idempoten dan wajib memeriksa tenantId (lihat catatan memori tentang kebocoran lintas tenant di system context).
   - Migration: **tidak**, kecuali butuh kolom penanda jurnal di settlement (misalnya `journalEntryId`). Jika perlu, migration aditif.

5. **Keputusan atas `ResellerPackagePrice` (Pasal 78–79, Pasal 223(2)b.3).**
   - Apa: pilih salah satu: sambungkan ke penagihan dengan `endsAt` wajib dan tampil di portal pelanggan, atau hapus.
   - Kenapa: fitur ini sekarang mati dan menimbulkan kesan harga reseller berlaku padahal invoice tidak memakainya. Bila dipakai sebagai harga grosir, ia bertentangan dengan prinsip pendapatan dibukukan ISP.
   - Dampak: bila dihapus, perlu `[REMOVED]` dan migration drop multi-step sesuai kebijakan destruktif proyek.
   - Migration: **ya, bila dihapus** (multi-step, lapor dulu ke pemilik); tidak, bila disambungkan.

6. **Laporan pendapatan terpisah per reseller/outlet.**
   - Apa: laporan bulanan per reseller/outlet: pelanggan aktif, tagihan bruto, terbayar, komisi, status settlement. Bisa diekspor.
   - Kenapa: praktik baik dari PM 3/2021 (dicabut) dan panduan DJED 2025 ("dicatat secara terpisah dan dilaporkan"), sekaligus bukti bahwa pendapatan dibukukan ISP.
   - Migration: **tidak**.

7. **Status kemitraan SUSPENDED/TERMINATED.**
   - Apa: enum diperluas dengan alasan dan tanggal. Akrual komisi berhenti saat status bukan ACTIVE. Ada jejak audit.
   - Kenapa: hak ISP memutus kerja sama (panduan Kominfo) dan mitigasi risiko sanksi Pasal 225.
   - Migration: **ya**, perubahan enum dan kolom alasan/tanggal (aditif).

8. **Merek di tagihan dan co-branding.**
   - Apa: verifikasi semua template invoice, kuitansi, dan WA memuat merek ISP. Opsional: `Reseller.brandName` sebagai merek tambahan.
   - Kenapa: Pasal 223(2)b.1 dan b.4.
   - Migration: **ya, hanya bila menambah `brandName`**.

9. **KPI kualitas per reseller dan klausul larangan jual kembali di syarat berlangganan (PB).**
   - Apa: filter atau rincian self-assessment per reseller, dan klausul di syarat dan ketentuan pelanggan.
   - Migration: **tidak**.

10. **BHP/USO di luar soal reseller (PB, prioritas rendah untuk modul reseller).**
    - Apa: dukung pengecualian Pasal 192 dengan akun terpisah, misalnya penjualan perangkat, dan perhitungkan pembalikan debit di `BhpUsoService.ts:185-196`.
    - Migration: **tidak**.

## 4. Ketidakpastian yang perlu dikonfirmasi ke konsultan hukum atau Komdigi

1. **Status Permenkominfo 5/2021.** JDIH BPK mencatat "Berlaku", dicabut sebagian oleh Permenkomdigi 7/2026 yang hanya mengenai Pasal 153–175 tentang registrasi seluler. Halaman JDIH Komdigi justru berlabel "TIDAK BERLAKU" tanpa menyebut penggantinya. Perlu dikonfirmasi ke JDIH Komdigi.
2. **Nomor pasal 223 dan ayatnya.** Disimpulkan dari urutan teks dan rujukan di Pasal 225, karena salinan yang terbaca tidak mencetak label pasal. Cek ulang di PDF resmi BN 2021/No.303.
3. **Kode KBLI.** 61994 (KBLI 2020) kemungkinan menjadi 61201 di KBLI 2025. Cek kode yang aktif di OSS sebelum memasang validasi `kbliCode`. Tingkat risiko di bawah PP 28/2025 juga belum dicek.
4. **Larangan sub-reseller dan "harga ditetapkan ISP".** Keduanya tidak lagi tertulis di Permenkomdigi 15/2025 (bagian persyaratan berisi "-"). Tidak tertulis belum tentu berarti diperbolehkan.
5. **Subjek kewajiban perlindungan konsumen** (Pasal 223(2)d): reseller, ISP, atau keduanya.
6. **Perlakuan akuntansi dan pajak komisi.** Apakah komisi sebagai beban sudah tepat, PPh atas komisi (misalnya PPh 21/23), dan apakah dasar komisi termasuk PPN. Perlu dikonfirmasi ke akuntan atau konsultan pajak.
7. **Pasal 78 untuk harga khusus reseller.** Berlaku hanya bila harga itu adalah tarif ke pelanggan akhir dan berada di bawah biaya pokok. Sistem tidak menyimpan data biaya pokok per paket.
8. **Surat edaran atau aturan baru 2025–2026 yang belum terverifikasi.** Antara lain SE Ditjen PPI tentang kewajiban jual kembali (bernomor 2585), SE Menkomdigi 4/2025, dan klaim "ISP wajib memutus akses mitra reseller ilegal" (Okt 2026). Bila ada, kewajiban ISP bisa bertambah, misalnya pelaporan daftar mitra ke Komdigi.
9. **Denda Pasal 47 dan KUHP baru** (UU 1/2023, berlaku 2 Januari 2026): kemungkinan denda dikonversi ke sistem kategori.
10. **Bukti tagihan agar dipersamakan dengan faktur pajak** (PMK 81/2024): elemen wajibnya belum diverifikasi.
11. **Kanal konfirmasi resmi:** layanan.djed@komdigi.go.id, untuk skema bagi hasil dan untuk reseller yang mengoperasikan jaringan akses sendiri.