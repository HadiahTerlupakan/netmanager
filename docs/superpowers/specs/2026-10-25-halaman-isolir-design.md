# Halaman isolir per tenant — rancangan

Tanggal: 2026-10-25
Status: rancangan, menunggu persetujuan pemilik

## Tujuan dan alasan

Pelanggan PPPoE yang diisolir mendapat IP dari `expired-pool` (10.127.0.0/18).
Router membelokkan HTTP dan HTTPS-nya ke web proxy 8181
(`netmanager-redirect-expired`), lalu web proxy menentukan apa yang dilihat
pelanggan (`/ip proxy access`, comment `added by netmanager - 10.127.0.0/18`).

Saat ini pelanggan isolir tidak melihat halaman apa pun:
- `isolirUrl` router kosong secara bawaan. Router tanpa URL tidak mendapat web
  proxy, jadi pelanggan isolir hanya terputus tanpa penjelasan.
- Router yang diberi URL (misalnya `isolir.radpro.id` di ROUTERLAB) membelokkan
  pelanggan ke domain yang belum melayani halaman.

Yang diinginkan pemilik:
1. Setiap tenant (ISP) bisa mengatur isi halaman isolirnya sendiri dari menu
   admin, dengan gaya menu Website (form per bagian).
2. **Halaman bawaan disimpan dan disajikan oleh router itu sendiri**, lewat web
   proxy, supaya tidak membebani server dan tetap tampil walaupun server atau
   VPN mati.
3. Tenant bisa memasang subdomain khusus miliknya, misalnya `isolir.tenantA.com`,
   di samping domain admin yang sudah ada (misalnya `admin.tenantA.com`).
   Router tenant itu lalu membelokkan pelanggan ke domain tersebut, dan
   halamannya disajikan dari server.
4. URL isolir per router tetap bisa diisi manual.
5. **Ada pilihan mode halaman isolir per router.** Termasuk mode tanpa web proxy
   RouterOS sama sekali, untuk board kelas bawah: router hanya meng-dst-nat
   HTTP pelanggan isolir ke server pusat, dan server yang menyajikan halamannya.

`isolir.radpro.id/<slug>` **tidak** dipakai. Router yang tidak diberi URL dan
tenantnya tidak punya domain isolir memakai halaman bawaan di router.

## Bukan tujuan

- Menampilkan data pelanggan tertentu (nama, tagihan). Billing tidak bisa
  mengenali pelanggan dari request, dan halaman bawaan bahkan tidak menyentuh
  server. Halaman hanya menunjukkan identitas tenant.
- Pembayaran di halaman ini.
- Membuka akses ke WhatsApp atau portal pembayaran selama isolir (lihat
  keputusan perancang).
- Mengubah menu Website radpro.id (landing page global, khusus super admin).
- HTTPS. Pelanggan yang membuka situs HTTPS tetap hanya melihat koneksi gagal,
  karena HTTPS tidak bisa dibelokkan tanpa peringatan sertifikat.

## Yang akan dibangun

### 1. Isi halaman yang bisa diatur tenant

Satu konfigurasi per tenant. Semua field opsional, dan field yang kosong memakai
default:

| Field | Default bila kosong |
|---|---|
| Logo | logo tenant dari Pengaturan → Logo, atau tanpa logo |
| Nama ISP | nama tenant |
| Judul | "Layanan Internet Anda Sedang Diisolir" |
| Pesan (teks bebas, multi-baris) | teks umum: layanan dihentikan sementara, silakan lakukan pembayaran atau hubungi CS |
| Info pembayaran: daftar {bank/e-wallet, nomor, atas nama} | rekening aktif dari Pengaturan → Rekening Perusahaan (`CompanyBankAccount`) |
| WhatsApp CS: nomor + teks pesan awal | tidak ditampilkan |
| Link pembayaran / portal pelanggan: label + URL | tidak ditampilkan |
| Kontak tambahan + jam operasional (teks) | tidak ditampilkan |
| Warna utama | warna bawaan |

Menu admin: **Pengaturan → Halaman Isolir**. Menu ini bisa dibuka admin tenant
dengan permission yang dipakai halaman Pengaturan lain (builder memilih), dan
isinya dibatasi tenant pengguna. Di menu yang sama ada:
- **Pratinjau** halaman bawaan, berupa HTML yang sama persis dengan yang dikirim
  ke router, dirender di admin;
- **status pengiriman** ke router-router tenant (bagian 3);
- **domain isolir tenant** dan statusnya (bagian 5), atau tautan ke tempat
  domain dikelola.

Satu renderer menghasilkan HTML dari konfigurasi. Renderer yang sama dipakai
untuk file di router dan untuk halaman server di domain isolir tenant, supaya
kedua versi selalu sama.

### 2. Mode isolir per router

Form tambah/edit NAS punya pilihan **Mode halaman isolir**, disimpan per router
(kolom baru):

| Mode | Untuk siapa | Yang dilakukan router |
|---|---|---|
| **Halaman di router** (default) | umum | web proxy RouterOS menyajikan `webproxy/error.html` |
| **Server pusat** | board kelas bawah / minim resource | tanpa web proxy; dst-nat TCP 80 ke server pusat |
| **Redirect** | tenant dengan domain isolir sendiri, atau URL lain | web proxy RouterOS membelokkan ke URL |

Router yang sudah ada dimigrasikan dengan aturan berikut: yang punya
`isolirUrl` menjadi **Redirect**, sisanya **Halaman di router**.

Mode **Redirect** memakai `isolirUrl` router bila diisi. Bila kosong, mode ini
memakai domain isolir tenant yang terverifikasi dan SSL-nya aktif. Form menolak
pilihan Redirect bila keduanya tidak ada. Kalau saat provisioning domain tenant
ternyata tidak aktif lagi, router jatuh ke Halaman di router dan log
provisioning mencatatnya. Setting global `ISOLIR_URL` tidak lagi dipakai.

Konfigurasi router per mode:

| | Halaman di router | Server pusat | Redirect |
|---|---|---|---|
| Web proxy 8181 | aktif | **dimatikan** (bila billing yang menyalakannya) | aktif |
| NAT `netmanager-redirect-expired` | TCP 80,443 → redirect 8181 (seperti sekarang) | TCP 80 → dst-nat `<IP server pusat>:<port tenant>` | TCP 80,443 → redirect 8181 |
| `/ip proxy access` (comment billing) | `action=deny` | dihapus | `action=redirect action-data=<host[/path]>` |
| `netmanager_allow` | IP billing | IP billing + IP server pusat | IP billing + host isolir |
| File `webproxy/error.html` | ditulis billing | tidak disentuh | tidak disentuh |

Filter isolir menolak TCP dari 10.127.0.0/18, sedangkan bypass forward
mengizinkan tujuan di `netmanager_allow`. Karena itu, IP server pusat harus
masuk list itu supaya trafik dst-nat bisa lewat. Untuk mode Server pusat, HTTPS
(443) tidak dibelokkan dan tetap ditolak, karena server pusat hanya melayani
HTTP biasa.

Perubahan pada provisioning yang sekarang:
- `provisionWebProxy` tidak lagi berhenti saat URL kosong. Web proxy dipasang
  untuk Halaman di router dan Redirect, dan dimatikan untuk Server pusat.
- Rule NAT `netmanager-redirect-expired` sekarang args-nya bergantung mode
  (redirect 8181 atau dst-nat), dan perpindahan mode dipulihkan lewat set
  seperti rule lain.
- Pemisahan host dan path: address list memakai host saja, sedangkan
  `action-data` membawa host beserta path.
- Perpindahan mode memakai pemulihan konfigurasi yang sudah ada (e9284be05):
  rule proxy access di-set ke nilai mode yang berlaku, dan entri
  `netmanager_allow` yang bukan IP server atau host isolir saat ini dihapus
  (list itu milik billing seluruhnya).
- Hapus router menghapus seluruh `netmanager_allow`, rule proxy access billing,
  dan `webproxy/error.html` buatan billing, tanpa bergantung pada URL yang
  dihitung ulang.

### 3. Halaman di router

- Disimpan di `webproxy/error.html`. RouterOS menyajikan file ini untuk
  request yang di-deny web proxy. Status HTTP-nya 403, tetapi browser
  menampilkan isinya seperti halaman biasa.
- Hanya satu file HTML dengan CSS inline, tanpa script dan tanpa aset luar.
  Logo disisipkan sebagai data URI yang sudah diperkecil. Kalau hasilnya
  melewati batas ukuran (di bawah), logo dihilangkan dan tenant diberi tahu di
  pratinjau.
- Ditulis pada tambah NAS dan Reconfigurasi (hanya kalau isinya berbeda), dan
  dikirim ke semua router tenant yang memakai mode ini setiap kali tenant
  menyimpan Halaman Isolir. Pengiriman berjalan di latar belakang, satu router
  satu koneksi. Router yang gagal atau offline dicatat dan tampil di status
  pengiriman. Router itu menyusul pada Reconfigurasi berikutnya.
- Teks dari tenant di-escape untuk HTML, dan rangkaian `$(` di-escape karena
  RouterOS mengganti variabel `$(...)` di halaman web proxy.

Router yang belum punya folder `webproxy` (folder itu belum ada di ROUTERLAB
sebelum `/ip proxy reset-html`) harus tetap bisa ditulisi. Builder memilih
caranya untuk RouterOS v7 dan v6, misalnya `reset-html` lalu `set contents`.
Mode publik masih bisa berisi router v6.

### 4. Server pusat (mode tanpa web proxy router)

- Satu layanan di radpro yang menjawab setiap request HTTP, apa pun host dan
  path-nya, dengan halaman isolir tenant. Halamannya memakai renderer yang
  sama. Ini bukan proxy (bukan Squid): tidak ada yang diteruskan ke internet.
- **Tenant dikenali dari port.** Setiap tenant mendapat satu port tetap dari
  sebuah rentang, misalnya 30900–30999, yang disimpan pada konfigurasi
  Halaman Isolir tenant dan dialokasikan saat pertama dibutuhkan. Yang sampai
  ke server hanya IP router hasil masquerade dan Host situs asli, jadi
  keduanya tidak bisa dipakai.
- Router tanpa tenant memakai port untuk halaman default.
- Port yang tidak dialokasikan tidak menjawab apa pun.
- Router VPN juga memakai IP publik server pusat lewat WAN, bukan lewat tunnel,
  karena hub VPN menolak trafik dari alamat pelanggan.
- Bentuk deploy (Service NodePort atau satu listener dengan banyak port) dan
  rentang port diserahkan ke builder, mengikuti cara RADIUS dibuka sekarang
  (NodePort 30812/30813). **Membuka port di firewall radpro dan menerapkan
  manifest baru memerlukan izin pemilik**, karena radpro host produksi
  bersama.
- Kalau server pusat mati, pelanggan tetap terisolir, tetapi tanpa halaman.

### 5. Domain isolir tenant (disajikan server)

Sekarang `TenantDomain` hanya satu baris per tenant (`tenantId @unique`), dan
nama Certificate, Secret, dan IngressRoute diturunkan dari `slug`
(`buildTenantTlsSecretName(slug)`, `deleteCertificate(slug)`). Rancangan ini
menambah domain kedua bertujuan isolir. Domain itu melewati alur yang sama:
tenant memasang A record ke IP server, atau CNAME. Lalu cron atau verifikasi
manual memeriksa DNS, cert-manager membuat sertifikat, dan IngressRoute
dipasang.

Syaratnya:
- Domain admin yang sudah ada tidak berubah perilakunya. Nama resource K8s yang
  sudah ada tidak berganti, karena mengganti nama memicu penerbitan ulang
  sertifikat untuk semua tenant.
- Resource domain isolir bernama `<slug>-isolir` (keputusan perancang), supaya
  tidak bertabrakan dengan domain admin.
- Menghapus atau menonaktifkan domain isolir hanya menghapus resource miliknya.
- Semua pembaca `TenantDomain` yang menganggap satu baris per tenant ikut
  diubah, termasuk `lib/tenant-context.ts`, `public-tenant-host.ts`, cron
  verifikasi, cek SSL, dan halaman domain admin/tenants/[id]/domain. Domain
  isolir tidak pernah dianggap domain admin.
- Halaman domain menampilkan kedua domain dan status masing-masing.
- Domain isolir sebaiknya DNS-only, tidak lewat proxy Cloudflare. Router
  mengizinkan IP hasil DNS domain itu, dan IP Cloudflare dipakai bersama
  banyak situs lain. Teks petunjuk pemasangan domain menyebut hal ini.

Bentuk skemanya diserahkan ke builder: kolom `purpose` dengan unique
(tenantId, purpose), atau tabel terpisah. Syaratnya, migrasi tidak merusak
baris yang ada, dan baris lama dianggap domain admin.

Routing di `proxy.ts`: host yang terdaftar sebagai domain isolir tenant
di-rewrite ke halaman isolir tenant itu. Hanya halaman itu dan aset statisnya
yang dilayani, sedangkan path lain, termasuk `/admin` dan `/api`, mendapat 404.
Host ini bisa dibuka dari jaringan pelanggan isolir, jadi harus tetap sempit.
Logo dilayani dari host itu sendiri.

Saat domain isolir menjadi aktif atau gagal, router tidak di-reconfigure
otomatis. Halaman Isolir menampilkan petunjuk "jalankan Reconfigurasi Mikrotik
agar router memakai alamat baru". Router mode Redirect yang bergantung pada
domain yang gagal jatuh ke Halaman di router pada provisioning berikutnya.

## Sudah dibuktikan (ROUTERLAB, RouterOS 7.24.5, 2026-10-25)

- **Redirect membawa path.** `action=redirect action-data=isolir.radpro.id/tes-slug`
  menjawab `http://example.com/abc` dengan `307 Location: http://isolir.radpro.id/tes-slug`.
- **Halaman di router.** Setelah `/ip proxy reset-html`, isi
  `webproxy/error.html` diganti 5,9 KiB HTML lewat CLI `/file set contents=`.
  Rule `action=deny` menyajikan isi itu utuh (6045 byte, HTTP 403) tanpa
  menghubungi server. Rule uji dan isi file sudah dikembalikan.

- **Batas ukuran lewat RouterOS API** (node-routeros-v2, `/file/add =contents=`):
  4, 16, dan 32 KiB tertulis utuh, sedangkan 64 KiB memutus koneksi API. Batas
  ukuran halaman di router karena itu **24 KiB**.

## Keputusan perancang (bukan pemilik)

- WhatsApp dan link pembayaran tetap tidak bisa dibuka selama isolir, karena
  tidak ada domain tambahan di `netmanager_allow`. Halaman menampilkan nomor WA,
  rekening, dan URL dalam teks yang jelas. Halaman server juga diberi tombol
  salin. Halaman di router tidak punya script, jadi teksnya cukup bisa dipilih.
  Pelanggan memakai data seluler untuk membayar atau menghubungi CS.
- Pesan ditampilkan sebagai teks biasa dengan baris baru. HTML dan markdown
  tidak dirender.
- Mode dipilih per router dengan default Halaman di router, bukan per tenant.
- Router tanpa tenant (`tenantId` null) memakai isi default dengan nama
  "Layanan Internet".
- Setelah deploy, router yang ada baru mendapat halaman isolir setelah
  Reconfigurasi. Langkah ini dijalankan pemilik dari Reconfigurasi Mikrotik
  (Select All), atau oleh asisten dengan persetujuan pemilik.

## Pengujian

- Unit: validasi dan fallback mode, args NAT, proxy access, dan address list
  per mode (termasuk perpindahan antar ketiga mode), alokasi port tenant,
  server pusat menjawab halaman tenant sesuai port,
  pemisahan host dan path, escape HTML dan `$(`, batas ukuran dan
  penghilangan logo, default isi, pembatasan tenant pada API pengaturan,
  pengiriman saat simpan (router gagal tercatat), routing host isolir
  (termasuk 404 untuk `/admin` dan `/api`), dan perpindahan mode yang
  membersihkan entri lama.
- Migrasi: baris `TenantDomain` lama tetap menjadi domain admin, dan
  sertifikatnya tidak diterbitkan ulang.
- Lab end to end dengan `tes-lab-02`, untuk setiap mode: isolir, lalu buka
  situs HTTP dari client lab, dan halaman tenant harus tampil. Untuk Halaman di
  router: ubah isi di menu, dan halaman baru harus tampil tanpa Reconfigurasi.
  Untuk Server pusat: web proxy router mati. Aktifkan kembali.
