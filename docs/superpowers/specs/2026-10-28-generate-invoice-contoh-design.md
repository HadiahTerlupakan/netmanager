# Generate Invoice Contoh — rancangan

Tanggal: 2026-10-28. Status: draf, menunggu persetujuan pemilik.

## Maksud

Admin membutuhkan kumpulan invoice lunas yang tampak wajar untuk dua keperluan:
demo aplikasi, dan contoh bentuk laporan pelanggan yang rapi untuk ditunjukkan
ke mitra. Hasilnya berupa ZIP berisi PDF per invoice.

Semua isi invoice fiktif: nama, alamat, nomor HP, dan pembayarannya. Karena itu
setiap dokumen selalu bertanda CONTOH, dan modul ini terpisah total dari billing.

## Tujuan

- Admin bisa mengatur paket, jumlah pelanggan, rentang bulan, area alamat di
  peta, jatuh tempo, tanggal bayar, dan perlakuan PPN dalam satu form.
- Hasilnya ZIP berisi satu PDF per invoice, semua berstatus LUNAS.
- Setiap generate tersimpan sebagai riwayat per mitra, dan bisa diunduh ulang
  dengan isi yang sama persis.

## Bukan tujuan

- Menyambung set contoh ke bulan berikutnya, mengganti sebagian pelanggan, atau
  memantau mitra bulan per bulan dengan data contoh. Fitur ini sudah diminta
  dan ditolak. Kalau pemantauan mitra bulanan dibutuhkan, jawabannya fitur
  pelaporan mitra dengan data asli, bukan modul ini.
- Mengirim hasil ke mitra dari aplikasi. Admin mengunduh lalu membagikannya
  sendiri.
- Akses untuk akun mitra.

## Anti-tujuan (dianggap gagal walau fitur lain jalan)

- Ada PDF atau berkas apa pun dari modul ini yang tidak bertanda CONTOH, atau
  ada pengaturan untuk mematikan tanda itu.
- Modul menulis ke tabel billing (`Invoice`, `Payment`, `Pelanggan`), ke jurnal
  atau laporan akuntansi, atau ke laporan regulasi. Modul juga tidak boleh
  muncul di data mana pun di luar modul ini.
- Nomor HP lengkap yang mungkin milik orang sungguhan.
- Nomor invoice atau ID pelanggan yang bisa tertukar dengan invoice asli.

## Akses dan menu

- Menu baru di bawah Keuangan: "Invoice Contoh", kode
  `FINANCE.SAMPLE_INVOICES`. Didaftarkan di `lib/menu-config.ts`, dipetakan di
  `components/layout/admin-sidebar/adminSidebarMenu.ts`.
- Izin baru `invoice_contoh` (`read` untuk melihat riwayat dan mengunduh,
  `create` untuk generate, `update` untuk mengubah pengaturan batas, `delete`
  untuk menghapus riwayat). Didaftarkan di
  `lib/permission-config.ts` dan `lib/resource-capabilities.ts`, mengikuti pola
  `payment_gateway`.
- Hanya admin yang diberi izin itu. Akun mitra tidak punya akses. Izin tidak
  diberikan otomatis ke peran yang ada; pemilik memberikannya per peran.

## Form generate

| Isian | Aturan |
|---|---|
| Mitra | Dipilih dari daftar mitra tenant (`GET /api/admin/mitra`). Dipakai sebagai label riwayat dan nama ZIP. Riwayat menyimpan id mitra dan salinan namanya, tanpa relasi database (mitra ada di database terpisah); riwayat tetap ada walau mitra dihapus. |
| Identitas penerbit | Nama perusahaan, alamat, telepon. Terisi otomatis dari `TaxConfig.companyName` bila ada, dan bisa diubah. Disimpan bersama riwayat. |
| Paket | Minimal satu baris: nama, kecepatan, harga (rupiah, bilangan bulat > 0). Setiap pelanggan mendapat satu paket acak, dengan peluang sama, dan paketnya tetap untuk semua bulan. |
| Jumlah pelanggan | Minimal 1, maksimal sesuai pengaturan batas (lihat "Pengaturan batas"). |
| Rentang bulan | Bulan awal dan bulan akhir, tidak boleh melewati bulan berjalan (invoice LUNAS untuk bulan yang belum datang tidak masuk akal), panjangnya sesuai pengaturan batas. Jumlah PDF = jumlah pelanggan × jumlah bulan. Form menampilkan angka ini sebelum generate dan menolak yang melewati batas. |
| Area alamat | Titik pusat dipilih dengan klik di peta (komponen peta yang sudah ada di `components/map/`), dan radius 200 m sampai 10 km. |
| Jatuh tempo | Tanggal dalam bulan (1–28), sama untuk semua invoice, di bulan periode tagihan itu sendiri. |
| Tanggal bayar | Pilihan "acak dalam bulan tagihan" (hari acak di antara tanggal 1 dan hari terakhir bulan itu; untuk bulan berjalan paling lambat hari ini), atau "seragam" dengan tanggal 1–28 (untuk bulan berjalan, ditolak bila tanggal itu belum lewat). |
| PPN | Tiga pilihan. "Tanpa PPN": baris PPN tidak dicetak. "Sudah termasuk harga paket": DPP = harga ÷ 1,11 dibulatkan ke rupiah, PPN = harga − DPP. "Ditambahkan ke harga": DPP = harga, PPN = 11% × harga dibulatkan ke rupiah, total = DPP + PPN. |

## Data acak

- **Nama:** dari daftar nama depan dan belakang Indonesia yang disimpan di repo
  sebagai berkas data modul. Repo belum punya daftar ini.
- **Alamat:** nama jalan asli dari OpenStreetMap di dalam radius, ditambah nomor
  rumah acak 1–200, lalu kelurahan/desa, kecamatan, dan kabupaten/kota tempat
  jalan itu berada. Jalan tanpa nama diabaikan.
  - Data diambil dari Overpass API **oleh browser admin**, bukan server: pada
    2026-10-28 pod produksi tidak bisa menjangkau overpass-api.de maupun
    overpass.kumi.systems (timeout), sementara CSP browser mengizinkan HTTPS
    keluar. Browser mengirim daftar jalan beserta wilayahnya ke server bersama
    permintaan generate, dan server memvalidasi bentuk serta jumlahnya.
  - Form menampilkan jumlah jalan yang ditemukan setelah area dipilih, sebelum
    tombol generate aktif.
  - Bila jalan bernama yang ditemukan kurang dari 5, generate ditolak dengan
    pesan untuk memperbesar radius.
  - Bila Overpass tidak bisa dihubungi, generate gagal dengan pesan yang jelas;
    tidak ada alamat karangan sebagai pengganti.
  - Banyak pelanggan boleh berada di jalan yang sama, dengan nomor rumah
    berbeda.
- **Nomor HP:** awalan seluler Indonesia yang wajar (0812, 0813, 0821, 0852,
  0857, 0878, 0896), dan hanya empat digit terakhir yang tampil. Contoh:
  `0812-****-4821`. Nomor lengkap tidak pernah dibuat atau disimpan.
- **ID pelanggan:** `CTH-` + nomor urut empat digit per generate.
- **Nomor invoice:** `CTH/YYYY/MM/NNNN`. Awalan `CTH` tidak dipakai oleh
  penomoran invoice asli.
- **Metode bayar:** acak per invoice dari Transfer bank, QRIS, e-wallet, dan
  Tunai.

## Isi PDF

Satu halaman A4 per invoice, dibuat dengan jsPDF (sudah ada di repo):

- pita merah di atas: "CONTOH — BUKAN TAGIHAN ASLI";
- watermark diagonal "CONTOH" di tengah halaman;
- kop: identitas penerbit dari form;
- judul INVOICE, nomor invoice, dan status LUNAS;
- kepada: nama, ID pelanggan, alamat, nomor HP tersamar (tanpa koordinat);
- periode tagihan, tanggal jatuh tempo, tanggal bayar, metode bayar;
- rincian: paket dan kecepatan untuk bulan itu, DPP, PPN 11%, total dibayar;
- catatan kaki: "Dokumen ini dibuat otomatis sebagai contoh format. Nama,
  alamat, dan transaksi bersifat fiktif."

Nama berkas di dalam ZIP: `YYYY-MM/CTH-NNNN.pdf`, dikelompokkan per bulan.
Nama ZIP: `contoh-invoice-<slug mitra>-<YYYYMM awal>-<YYYYMM akhir>.zip`.

## Pengaturan batas

- Batas tidak tertanam di kode. Ada panel "Pengaturan batas" di modul ini,
  disimpan per tenant, berisi: maksimal pelanggan per generate, maksimal
  rentang bulan, dan maksimal PDF per generate.
- Nilai awal 500 pelanggan, 12 bulan, 2.000 PDF. Admin dengan izin
  `invoice_contoh:update` bisa mengubahnya kapan saja.
- Satu-satunya batas yang tetap adalah **jumlah PDF per berkas ZIP** (2.000),
  untuk menjaga memori pod dan waktu tunggu ingress. Generate yang lebih besar
  dari itu tetap boleh: unduhannya dipecah menjadi beberapa ZIP per bulan
  (misalnya `...-2026-05.zip`, `...-2026-06.zip`), dan riwayat menampilkan
  tombol unduh per bagian. Bila satu bulan saja melebihi 2.000 PDF, bulan itu
  dipecah lagi menjadi bagian bernomor.

## Riwayat

- Setiap generate disimpan sebagai satu riwayat, tenant-scoped, di
  `prisma/schema.prisma` utama dengan migrasinya. Isinya: mitra (id dan nama
  salinan), pembuat, waktu, seluruh isian form, daftar pelanggan fiktif hasil
  acak (nama, alamat, HP tersamar, paket), serta tanggal bayar dan metode bayar
  per invoice.
- ZIP tidak disimpan. Unduh ulang menyusun PDF lagi dari data riwayat, sehingga
  isinya sama persis tanpa memanggil OpenStreetMap lagi.
- Halaman riwayat menampilkan daftar per mitra (filter mitra), dengan
  ringkasan: rentang bulan, jumlah pelanggan, jumlah PDF, pembuat, waktu. Ada
  tombol unduh ulang dan hapus.

## Pembuatan ZIP

- PDF dan ZIP dibuat di server dalam satu permintaan, lalu dikirim sebagai
  unduhan. Tidak ada job latar belakang.
- Riwayat ditulis lebih dulu, baru ZIP disusun. Bila unduhan terputus, admin
  mengunduh ulang dari riwayat.
- "Isi yang sama persis" berarti isi yang tampak sama, bukan berkas yang identik
  per byte. Semua tanggal cetak diambil dari waktu generate yang tersimpan,
  bukan waktu unduh.
- Bila waktu proses satu berkas 2.000 PDF terbukti melewati batas waktu
  ingress, ukuran per berkas diturunkan; jangan mengubahnya menjadi job latar
  belakang tanpa persetujuan.
- ZIP memakai `adm-zip`, yang sudah ada di repo.
- Satu berkas ZIP berisi paling banyak 2.000 PDF, supaya memori pod app
  (limit 3Gi) dan waktu tunggu ingress aman. Generate yang lebih besar diunduh
  per bagian (lihat "Pengaturan batas").

## Keputusan yang diambil sendiri (bisa dikoreksi pemilik)

- Nilai awal batas 500 pelanggan, 12 bulan, 2.000 PDF; semuanya bisa diubah
  admin. Yang tetap hanya 2.000 PDF per berkas ZIP, dengan unduhan dipecah
  per bagian bila lebih.
- Paket dibagi dengan peluang sama, tanpa bobot.
- Tanpa logo di kop. Belum ada tempat tunggal untuk logo perusahaan di repo.
- Tanggal bayar acak tidak dibatasi sebelum jatuh tempo.
- Metode bayar acak dengan peluang sama.
- Pilihan "Tanpa PPN" ditambahkan, untuk tenant yang bukan PKP.
- Jatuh tempo di bulan periode tagihan; bulan yang akan datang ditolak.
- Generate sinkron dalam satu permintaan, tanpa job latar belakang.
- Daftar jalan OSM diambil oleh browser, karena pod produksi tidak bisa
  menjangkau Overpass.
- Izin `invoice_contoh` diberikan manual per peran.

## Diserahkan ke pembangun

- Tata letak persis PDF dan form, mengikuti mockup yang sudah dilihat pemilik:
  `docs/superpowers/specs/2026-10-28-generate-invoice-contoh-mockup.html`.
- Struktur tabel riwayat (satu tabel dengan kolom JSON atau tabel pelanggan
  terpisah).
- Cara menentukan kelurahan/kecamatan/kota dari data OSM untuk setiap jalan.
- Penanganan batas laju dan waktu tunggu Overpass.
