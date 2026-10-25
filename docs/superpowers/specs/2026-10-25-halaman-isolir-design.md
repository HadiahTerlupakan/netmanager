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
4. URL isolir per router tetap bisa diisi manual dan mengalahkan semuanya.

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
- **domain isolir tenant** dan statusnya (bagian 4), atau tautan ke tempat
  domain dikelola.

Satu renderer menghasilkan HTML dari konfigurasi. Renderer yang sama dipakai
untuk file di router dan untuk halaman server di domain isolir tenant, supaya
kedua versi selalu sama.

### 2. Mode isolir per router

Mode dipilih saat provisioning (tambah NAS, Reconfigurasi, migrasi VPN), dengan
urutan:
1. `isolirUrl` router diisi → **redirect** ke URL itu;
2. tenant pemilik router punya domain isolir yang terverifikasi dan SSL-nya
   aktif → **redirect** ke `isolir.tenantA.com`;
3. selain itu → **halaman di router**.

`isolirUrl` yang kosong tetap kosong di database. Dengan begitu, domain isolir
yang baru dipasang tenant ikut terpakai pada Reconfigurasi berikutnya tanpa
mengedit router satu per satu. Setting global `ISOLIR_URL` tidak lagi dipakai.
Form tambah/edit router diberi petunjuk "kosongkan untuk memakai halaman isolir
tenant".

| | Redirect | Halaman di router |
|---|---|---|
| `/ip proxy access` (comment billing) | `action=redirect action-data=<host[/path]>` | `action=deny` |
| `netmanager_allow` | IP server + host isolir | IP server saja |
| File `webproxy/error.html` | tidak disentuh | ditulis billing |
| Web proxy 8181 | aktif | aktif |

Perubahan pada provisioning yang sekarang:
- `provisionWebProxy` tidak lagi berhenti saat URL kosong, karena web proxy
  selalu dipasang.
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

### 4. Domain isolir tenant (disajikan server)

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
agar router memakai alamat baru". Domain yang gagal membuat router jatuh ke
halaman di router pada provisioning berikutnya.

## Sudah dibuktikan (ROUTERLAB, RouterOS 7.24.5, 2026-10-25)

- **Redirect membawa path.** `action=redirect action-data=isolir.radpro.id/tes-slug`
  menjawab `http://example.com/abc` dengan `307 Location: http://isolir.radpro.id/tes-slug`.
- **Halaman di router.** Setelah `/ip proxy reset-html`, isi
  `webproxy/error.html` diganti 5,9 KiB HTML lewat CLI `/file set contents=`.
  Rule `action=deny` menyajikan isi itu utuh (6045 byte, HTTP 403) tanpa
  menghubungi server. Rule uji dan isi file sudah dikembalikan.

Belum diketahui: batas ukuran `contents` lewat RouterOS API. Builder mengukurnya
di lab dan memakai batas itu dengan cadangan aman sebagai batas ukuran halaman.

## Keputusan perancang (bukan pemilik)

- WhatsApp dan link pembayaran tetap tidak bisa dibuka selama isolir, karena
  tidak ada domain tambahan di `netmanager_allow`. Halaman menampilkan nomor WA,
  rekening, dan URL dalam teks yang jelas. Halaman server juga diberi tombol
  salin. Halaman di router tidak punya script, jadi teksnya cukup bisa dipilih.
  Pelanggan memakai data seluler untuk membayar atau menghubungi CS.
- Pesan ditampilkan sebagai teks biasa dengan baris baru. HTML dan markdown
  tidak dirender.
- Router tanpa tenant (`tenantId` null) memakai halaman di router dengan isi
  default dan nama "Layanan Internet".
- Setelah deploy, router yang ada baru mendapat halaman isolir setelah
  Reconfigurasi. Langkah ini dijalankan pemilik dari Reconfigurasi Mikrotik
  (Select All), atau oleh asisten dengan persetujuan pemilik.

## Pengujian

- Unit: urutan pemilihan mode, args proxy access dan address list per mode,
  pemisahan host dan path, escape HTML dan `$(`, batas ukuran dan
  penghilangan logo, default isi, pembatasan tenant pada API pengaturan,
  pengiriman saat simpan (router gagal tercatat), routing host isolir
  (termasuk 404 untuk `/admin` dan `/api`), dan perpindahan mode yang
  membersihkan entri lama.
- Migrasi: baris `TenantDomain` lama tetap menjadi domain admin, dan
  sertifikatnya tidak diterbitkan ulang.
- Lab end to end dengan `tes-lab-02`: isolir, lalu buka situs HTTP dari client
  lab. Halaman di router harus tampil. Ubah isi di menu, dan halaman baru harus
  tampil tanpa Reconfigurasi. Aktifkan kembali.
