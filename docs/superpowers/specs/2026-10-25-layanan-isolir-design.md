# Layanan isolir sendiri (mode Server isolir) — rancangan

Tanggal: 2026-10-25
Status: rancangan, menunggu persetujuan pemilik
Menggantikan: bagian 4 "Server pusat" di
`2026-10-25-halaman-isolir-design.md` (Rencana 2 lama: dst-nat ke IP publik
radpro, tenant dikenali dari port).

## Tujuan dan alasan

Saat ini halaman isolir disajikan web proxy RouterOS di router itu sendiri
(mode Halaman di router) atau dibelokkan web proxy ke URL lain (mode Redirect).
Pemilik ingin pilihan tanpa web proxy router, seperti layanan isolir yang
dipakai penyedia lain: router hanya meneruskan trafik web pelanggan isolir lewat
tunnel, dan **sebuah layanan isolir milik sendiri** yang menjawabnya.

Yang diinginkan pemilik:
1. Layanan isolir berdiri sendiri, terpisah dari aplikasi netmanager dan dari
   core `netmanager-vpn`.
2. Bukan Squid. Layanan tidak meneruskan apa pun ke internet; ia hanya
   menjawab setiap permintaan dengan halaman isolir.
3. **HTTPS ikut dijawab** dengan sertifikat buatan sendiri. Pemilik menerima
   bahwa browser menampilkan peringatan sertifikat; itu lebih baik daripada
   koneksi yang hanya timeout seperti sekarang.
4. Router kecil tidak terbebani web proxy.

## Yang akan dilihat pelanggan

- Situs `http://` apa pun: halaman isolir tenant.
- Pop-up "Masuk ke jaringan" di Android/iOS/Windows: deteksi captive portal
  membuka alamat HTTP, dijawab halaman isolir (bukan 204/"Success"), sehingga
  sistem operasi menampilkan halaman itu.
- Situs HTTPS biasa: peringatan sertifikat; setelah pelanggan memilih lanjut,
  halaman isolir tampil.
- Situs HTTPS ber-HSTS (Google, YouTube, Facebook, Instagram, bank): peringatan
  tanpa tombol lanjut. Halaman tidak tampil di situs ini; ini batas teknis,
  bukan cacat.
- Aplikasi (WhatsApp, dll.): gagal tersambung.

## Bukan tujuan

- Menampilkan data pelanggan tertentu (nama, tagihan). Router me-masquerade
  trafik, jadi layanan hanya tahu router asalnya, bukan pelanggannya. Halaman
  tetap per tenant, sama dengan mode lain.
- Daftar putih situs (pembayaran/bank) selama isolir. Bisa ditambah kemudian
  lewat address list router; tidak perlu proxy.
- Router mode publik (tanpa VPN). Mereka tidak punya jalur ke layanan ini dan
  tetap memakai Halaman di router atau Redirect.
- Domain isolir tenant (Rencana 3) tidak berubah oleh rancangan ini.

## Jalur paket (sudah dipetakan dari kode `netmanager-vpn` origin/main)

```
HP pelanggan isolir (10.127.x.x)
  │ TCP 80 / 443 ke situs mana pun
  ▼
Router MikroTik
  dst-nat  80 → 10.99.0.1:30880,  443 → 10.99.0.1:30443
  src-nat  masquerade → IP overlay router (10.100.x.x)
  │ lewat tunnel WireGuard / L2TP
  ▼
Hub VPN (VPS, wg-nm / nmppp* → wg-up)
  ▼
Core VPN (node k8s, wg-core 10.99.0.1, hostNetwork)
  ▼  NodePort, externalTrafficPolicy: Local (sumber tetap 10.100.x.x)
Pod layanan isolir (namespace sendiri)
```

Fakta dari kode yang menentukan rancangan:
- Tunnel router berakhir di hub; core hanya melihat hub. Hub dan core tidak
  melakukan NAT, sehingga IP sumber yang tiba di core adalah IP overlay router.
- Saat ini router hanya boleh menjangkau 10.99.0.1 UDP 30812/30813 (RADIUS) dan
  ICMP. TCP SYN dari router dibuang di hub (`internal/firewall/render.go`), dan
  core membuang semua yang lain dari `wg-core` sebelum DNAT kube-proxy.
- RADIUS sudah memakai pola yang sama: Service NodePort dengan
  `externalTrafficPolicy: Local` di 10.99.0.1, dan netmanager mengenali router
  dari IP sumbernya (`nas.nasname`).
- Masquerade billing di router (`netmanager-masquerade`) sengaja tidak
  menyentuh tujuan privat, termasuk 10.99.0.1. Karena itu mode ini butuh rule
  srcnat sendiri; tanpa itu paket tiba di hub dengan sumber 10.127.x.x dan
  dibuang.

## Yang akan dibangun

### 1. Layanan isolir

Program kecil tersendiri, image sendiri, Deployment dan namespace sendiri
(`netmanager-isolir`).

- Mendengarkan HTTP (container 8080) dan HTTPS (container 8443), dibuka sebagai
  Service NodePort **30880** dan **30443** dengan `externalTrafficPolicy:
  Local`. Builder memastikan kedua NodePort belum dipakai.
- Pod harus berjalan di node yang sama dengan core VPN (yang memegang
  `wg-core`), karena `Local` hanya melayani di node yang punya pod-nya. Cluster
  radpro saat ini satu node (`radpro`, diperiksa 2026-10-25), jadi syarat ini
  terpenuhi; manifest tetap memakai `nodeSelector:
  kubernetes.io/hostname: radpro` supaya tidak diam-diam rusak bila node
  bertambah.
- Setiap permintaan, apa pun Host, path, dan method-nya, dijawab status 200
  dengan halaman isolir dan `Cache-Control: no-store`. Tidak ada proxy, redirect
  ke luar, atau koneksi keluar selain ke netmanager.
- HTTPS: satu sertifikat self-signed untuk semua nama, disimpan di Secret dan
  dibuat sekali saat deploy. Sertifikat per-SNI tidak dibuat karena hasilnya di
  browser sama saja (tetap tidak dipercaya).
- Menentukan halaman dari IP sumber koneksi (IP overlay router):
  1. cache di memori per IP, berlaku 60 detik;
  2. bila kedaluwarsa, minta ke netmanager (bagian 2);
  3. bila netmanager gagal, pakai cache lama sampai 24 jam;
  4. bila tidak ada sama sekali, halaman cadangan bawaan layanan ("Layanan
     internet Anda sedang diisolir. Silakan hubungi penyedia layanan Anda.").
- Tidak menyimpan data pelanggan. Log hanya hitungan per router dan galat.
- Pengaman karena terbuka untuk pelanggan: batas koneksi dan permintaan per IP
  sumber, batas ukuran header/body, timeout baca/tulis pendek, tanpa header
  `Server` versi. Builder memilih angka.
- `/healthz` hanya untuk probe kubelet; tidak ada endpoint lain.

Bahasa dan repo: **Go, repo baru `netmanager-isolir`** (keputusan perancang),
mengikuti `netmanager-vpn`: binari kecil tanpa akses database dan tanpa kode
aplikasi, karena permukaannya dijangkau langsung oleh pelanggan yang tidak
dipercaya. Renderer tetap satu, di netmanager.

### 2. Endpoint halaman di netmanager

Endpoint internal baru, misalnya `GET /api/internal/isolir/page?address=<ip>`:

- Hanya bisa dipanggil dengan token khusus layanan isolir (secret baru
  `ISOLIR_SERVICE_TOKEN`, terpisah dari token VPN), dan hanya dari dalam cluster.
- Mencari router VPN yang alamat overlay-nya = `address` (alamat yang dipakai
  netmanager untuk menjangkau router VPN, juga `nasname` RADIUS-nya; untuk
  WireGuard dan L2TP sama-sama dari pool 10.100.0.0/14). Builder memakai field
  yang sama dengan yang dipakai koneksi API ke router VPN, lalu
  mengembalikan HTML halaman isolir tenant router itu dari renderer yang sudah
  ada (`renderIsolirPage`), plus ETag.
- Alamat yang tidak dikenal mendapat halaman default "Layanan Internet",
  sama seperti router tanpa tenant di mode lain.
- Halaman untuk layanan ini tidak terikat batas 24 KiB milik router, tetapi
  tetap satu file tanpa aset luar, supaya tampil sama.

### 3. Mode router baru: Server isolir

`IsolirMode` mendapat nilai baru **`ISOLIR_SERVICE`** (label "Server isolir").
Hanya bisa dipilih untuk router dengan koneksi VPN; form menolak pilihan ini
untuk router publik. Router yang pindah dari VPN ke publik jatuh ke Halaman di
router saat provisioning, dan log provisioning mencatatnya.

| | Halaman di router | Redirect | **Server isolir** |
|---|---|---|---|
| Web proxy 8181 | aktif | aktif | **dimatikan** |
| Guard `netmanager-proxy-guard` | ada | ada | dihapus (proxy mati) |
| NAT `netmanager-redirect-expired` | 80,443 → redirect 8181 | 80,443 → redirect 8181 | 80 → dst-nat `10.99.0.1:30880` |
| NAT `netmanager-redirect-expired-https` | — | — | 443 → dst-nat `10.99.0.1:30443` |
| NAT `netmanager-masquerade-isolir` | — | — | srcnat masquerade, src 10.127.0.0/18, dst 10.99.0.1, tcp 30880,30443, ditaruh paling atas |
| `/ip proxy access` (comment billing) | deny | redirect | dihapus |
| `netmanager_allow` | IP billing | IP billing + host isolir | IP billing (10.99.0.1 sudah ada) |
| `webproxy/error.html` | ditulis | tidak disentuh | tidak disentuh |

- Dst-nat tetap memakai `dst-address-list=!netmanager_allow`, seperti rule
  sekarang.
- Mangle `netmanager-isolir-mss`: `change-mss` `clamp-to-pmtu` untuk TCP SYN
  dari 10.127.0.0/18 ke 10.99.0.1 port 30880,30443. Jalurnya melewati dua
  tunnel (router→hub, hub→core, MTU 1380); tanpa clamp, handshake TLS bisa
  macet walaupun HTTP lancar.
- 10.99.0.1 sudah ada di `netmanager_allow` untuk router VPN: provisioning
  menambahkan IP server billing ke list itu, dan untuk router VPN IP itu
  10.99.0.1 (terlihat di ROUTERLAB: `accept.10.99.0.1`).
- Filter forward isolir sudah mengizinkan tujuan di `netmanager_allow`, dan
  10.99.0.1 ada di list itu, jadi tidak ada perubahan filter router.
- Perpindahan antar ketiga mode memakai pemulihan konfigurasi yang sudah ada:
  rule milik mode lain dihapus atau di-set ke nilai mode yang berlaku.
- Simpan Halaman Isolir tidak perlu mengirim apa pun ke router mode ini;
  halaman baru tampil paling lambat 60 detik (cache layanan).
- Mode default tidak berubah (Halaman di router). Pemilik memilih mode per
  router.

### 4. Perubahan di `netmanager-vpn` (hub dan core)

Hanya membuka dua port TCP ke 10.99.0.1, tidak ada perubahan routing:
- Hub forward (`hubForwardWG` dan `hubForwardPPP`): terima dari `wg-nm` /
  `nmppp*` ke `wg-up` untuk `ip daddr 10.99.0.1 tcp dport {30880, 30443}`,
  termasuk SYN, ditaruh sebelum rule buang SYN. Balasan dari 10.99.0.1 sudah
  diterima rule yang ada. Rule DOCKER-USER disesuaikan bila perlu.
- Core `wgcore_in`: terima `ip saddr 10.100.0.0/14 ip daddr 10.99.0.1 tcp dport
  {30880, 30443}` sebelum rule drop.
- Test golden `testdata/*.nft` diperbarui.

Port lain tetap tertutup; router tetap tidak bisa saling menjangkau.
Firewall penyedia VPS hub tidak terpengaruh: aliran baru berada di dalam tunnel
WireGuard yang port UDP-nya sudah terbuka.

## Deploy dan izin

Semua langkah berikut menyentuh produksi bersama dan **memerlukan izin pemilik
per langkah**:
1. Rilis `netmanager-vpn` dengan rule baru: core (k8s) dan setiap hub (VPS).
2. Membuat namespace, Secret (sertifikat, token), Deployment, dan Service
   NodePort layanan isolir di cluster radpro.
3. Rilis netmanager (endpoint internal + mode baru).

Urutan aman: netmanager dan layanan isolir dulu (belum ada router yang
memakainya), lalu `netmanager-vpn`, lalu ROUTERLAB dipindah ke mode Server
isolir untuk uji lab.

## Kegagalan

- Layanan isolir mati atau tunnel putus: pelanggan tetap terisolir (filter
  router tetap menolak), hanya tanpa halaman. Sama dengan mode lain saat
  servernya mati.
- Netmanager mati: layanan memakai cache lama, lalu halaman cadangan.
- Router berpindah hub: tidak berpengaruh; IP overlay router tetap.

## Pengujian

- Unit (layanan isolir): jawaban 200 untuk host/path/method apa pun di HTTP
  dan HTTPS, pemilihan halaman dari IP sumber, cache 60 detik, cache lama saat
  netmanager gagal, halaman cadangan, batas per IP.
- Unit (netmanager): endpoint menolak tanpa token yang benar, lookup per
  `nasname`, alamat tak dikenal mendapat default; mode baru ditolak untuk
  router publik; args NAT, proxy, guard, dan perpindahan antar ketiga mode.
- Unit (`netmanager-vpn`): golden nft hub dan core memuat rule baru, rule SYN
  tetap membuang port lain.
- Lab end to end dengan ROUTERLAB dan `tes-lab-02`: isolir, lalu dari client
  lab buka `http://` → halaman tenant; `https://example.com` dengan curl `-k` →
  halaman tenant; deteksi captive portal Android dari HP bila tersedia; ubah
  isi Halaman Isolir → tampil dalam 60 detik tanpa Reconfigurasi; web proxy
  router mati. Aktifkan kembali, dan rule mode ini bersih saat pindah mode.

## Keputusan perancang (bukan pemilik)

- Go dan repo baru `netmanager-isolir`, tanpa akses database.
- NodePort 30880/30443 dan pola `externalTrafficPolicy: Local` mengikuti RADIUS.
- Satu sertifikat self-signed untuk semua nama.
- Cache 60 detik, cache lama sampai 24 jam.
- Nama mode `ISOLIR_SERVICE`, label "Server isolir"; default mode tidak berubah.
- Clamp MSS untuk aliran isolir, dipasang sejak awal.
- Uji lab dijalankan asisten di ROUTERLAB (akses SSH dan API tersedia).
- Data pelanggan per orang dan daftar putih situs tidak termasuk.
