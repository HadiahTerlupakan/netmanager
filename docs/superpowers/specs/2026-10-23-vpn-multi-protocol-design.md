# VPN MikroTik: pilihan protokol L2TP/IPsec, SSTP, PPTP — rancangan

Tanggal: 2026-10-23
Status: rancangan, menunggu persetujuan pemilik
Dasar: `2026-10-19-vpn-mikrotik-design.md` (WireGuard, sudah berjalan di
produksi sejak 2026-10-23). Rancangan ini hanya menambah; semua yang tidak
disebut di sini tetap seperti rancangan dasar.

## Tujuan dan alasan

Router NAS MikroTik harus tersambung ke billing (API netmanager) dan RADIUS
**lewat jaringan lokal di dalam tunnel**, bukan lewat IP publik. Saat ini satu-
satunya pipa adalah WireGuard. Pemilik ingin protokol bisa **dipilih per
router**: WireGuard, L2TP, SSTP, atau PPTP. Alasannya: pilihan yang dikenal
teknisi, dan jalan keluar saat WireGuard tidak bisa dipakai di sebuah lokasi
(misalnya UDP diblokir; SSTP lewat TCP).

Contoh yang dirujuk pemilik adalah script satu tempelan dari layanan VPN lain:
menghapus sisa client protokol apa pun, membuat satu client L2TP ke server
ber-domain, dan menambah route khusus ke alamat manajemen. Pengalaman itu yang
ditiru: **teknisi menempel satu script, router tersambung**.

## Keputusan pemilik

- Topologi: **billing + RADIUS → VPN → MikroTik NAS**. Router NAS yang memulai
  koneksi ke server VPN; billing dan RADIUS tetap di radpro dan menjangkau NAS
  hanya lewat tunnel.
- Protokol **dipilih per router** di netmanager: WireGuard, L2TP, SSTP, PPTP.
- **PPTP tetap disediakan, dengan peringatan** bahwa enkripsinya bisa dibobol.
- Yang diuji dan dijamin adalah **RouterOS v7**. Router v6 tidak masuk tahap
  ini (lihat "Bukan sasaran"). Sebagian besar router di lapangan sudah v7.
- Ada NAS **dengan dan tanpa IP publik**; justru mode VPN dibuat agar NAS tanpa
  IP publik bisa tersambung ke billing dan RADIUS.
- **Server L2TP/SSTP/PPTP pertama dipasang di radpro.** VPS ditambah nanti
  sebagai server kedua dan seterusnya.
- Ukuran keberhasilan (di bawah) disetujui pemilik; poin 4 untuk L2TP dan PPTP
  menunggu server kedua di IP lain (lihat "Pengerjaan bertahap").

## Ukuran keberhasilan

Untuk **setiap** protokol, di router uji v7:
1. Router tersambung setelah teknisi menempel satu script; tempel ulang tidak
   membuat objek ganda.
2. Netmanager login ke API router lewat alamat tunnel (`10.100.x.x`), dan router
   melihat sumber `10.99.0.1` (tanpa NAT).
3. Login PPPoE pelanggan diautentikasi RADIUS lewat tunnel, dan FreeRADIUS
   melihat alamat tunnel router sebagai sumber dan NAS-IP.
4. Server VPN pertama dimatikan: router pindah sendiri ke server cadangan dalam
   ≤ 60 s (sasaran yang sama dengan WireGuard), core mencatat perpindahan, dan
   poin 2–3 tetap berjalan.

## Sasaran

1. Form tambah router (mode VPN) punya pilihan protokol; default WireGuard.
   Script satu tempelan dibuat sesuai protokol yang dipilih.
2. Router VPN yang sudah ada bisa diganti protokolnya dari halaman edit dengan
   menempel script baru. Alamat tunnel `/32`, `ipAddress`, dan `nasname` tidak
   berubah.
3. Setiap hub melayani keempat protokol, sehingga pemasangan VPS tetap satu
   perintah dan auto switch antar hub berlaku untuk semua protokol.
4. Perintah instal hub juga membuka firewall di dalam VPS (ufw/firewalld bila
   aktif), dan panduan di modal "Tambah Server VPN" mencantumkan semua port yang
   harus dibuka di panel provider.
5. Router WireGuard yang sudah berjalan tidak tersentuh: tidak perlu tempel
   ulang dan tidak ada perubahan perilaku.

## Bukan sasaran

- **RouterOS v6.** Sintaks routing v6 berbeda dan tidak ada router v6 untuk uji.
  Toggle "Pakai VPN" tetap hanya untuk v7, apa pun protokolnya. Bisa ditambah
  nanti sebagai rancangan terpisah.
- **OpenVPN.** Tidak memberi apa pun yang belum diberikan SSTP.
- **Pindah protokol otomatis** (misalnya WireGuard gagal lalu pindah ke L2TP).
  Satu router memakai satu protokol; auto switch hanya antar hub dalam
  protokol yang sama.
- **Autentikasi per router untuk IPsec** (sertifikat per router). L2TP/IPsec
  memakai PSK per hub; lihat risikonya di bawah.
- IPv6, pembagian beban, kembali otomatis ke server pertama (sama dengan
  rancangan dasar).

## Anti-sasaran

- L2TP diterima hub **tanpa IPsec**, sehingga password API dan RADIUS berjalan
  terbuka.
- Router PPTP terpasang tanpa admin pernah melihat peringatannya.
- Sebuah sesi PPP bisa mengirim paket dengan sumber `/32` milik router lain,
  atau menjangkau router lain (isolasi antar tenant yang sudah ada di WireGuard
  harus berlaku sama).
- RADIUS melihat IP publik router, bukan alamat tunnel.
- Router WireGuard yang ada terganggu oleh perubahan ini.
- Deploy netmanager atau restart service VPN memutus **sesi PPPoE pelanggan** di
  router, atau membuat tunnel router putus lebih lama dari satu kali login ulang
  client (lihat "Hub").
- Script mengunduh dan menjalankan apa pun dari server (`/tool fetch` +
  `/import`), seperti di contoh layanan lain.

## Fakta yang membatasi rancangan

- Core memilih hub aktif dari stempel waktu per hub (`internal/core/active.go`,
  `ChooseActive`), saat ini handshake WireGuard. Stempel yang sama bisa diisi
  hub untuk sesi PPP (lihat "Hub").
- Hub di radpro berjalan di jaringan bridge Docker supaya route `/32`-nya tidak
  bentrok dengan core. GRE (PPTP) dan IPsec tidak lewat port publish Docker
  biasa, dan L2TP/PPTP memakai port tetap (UDP 500/4500, TCP 1723) yang hanya
  bisa dipakai satu hub per IP.
- radpro adalah host produksi bersama: core, billing, RADIUS (NodePort
  30812/30813), dan service lain sudah memakai port di sana, termasuk
  kemungkinan TCP 443. Perubahan di radpro dijalankan pemilik, bukan builder.
  Cek 2026-10-24: kernel 5.15.0-191; modul `ppp_generic`, `l2tp_ppp`,
  `l2tp_netlink`, `pptp`, `ppp_mppe`, `nf_conntrack_pptp`, `nf_nat_pptp`,
  `xfrm_user`, `esp4`, `af_key` tersedia; `/dev/ppp` ada; tidak ada daemon IPsec
  lain; tidak ada socket yang mendengarkan di 443, 500, 4500, 1701, 1723
  sebagai socket. Cek NAT: **TCP 443 di `31.56.30.53` dipakai Traefik** (k3s,
  DNAT hostPort ke pod ingress), jadi SSTP di radpro tidak bisa di 443. UDP 500,
  4500, 1701 dan TCP 1723 tidak punya aturan NAT apa pun.
  Hub PPP pertama tetap harus hidup di sana (lihat "Hub PPP di radpro").
- Router dan netmanager sudah memakai satu routing table khusus
  `netmanager-vpn` dengan rule `lookup-only-in-table` ke `10.99.0.0/24` dan
  `10.99.128.0/24`; tidak ada yang menyentuh table `main`.
- Netmanager mengganti daftar server router lewat API dengan menulis ulang
  sumber script switch (`routeros.SwitchSource`), tanpa tempel ulang.
- Uji lab 2026-10-23 menemukan dua perilaku RouterOS yang wajib dipertahankan
  di script baru: script dan scheduler butuh policy `policy` agar variabel
  global bertahan, dan tanda gagal hub dikunci per `host|port`
  (`2026-10-19-vpn-mikrotik-spike-results.md`).

## Rancangan

### Per protokol, di router

| | WireGuard (ada) | L2TP/IPsec | SSTP | PPTP |
|---|---|---|---|---|
| Interface | `wireguard` `netmanager-vpn` | `l2tp-client` `netmanager-vpn` | `sstp-client` `netmanager-vpn` | `pptp-client` `netmanager-vpn` |
| Alamat `/32` | di loopback `netmanager-lo` | diberikan server ke interface PPP | sama | sama |
| Kredensial | kunci WG per router | user/password PPP per router + PSK IPsec per hub | user/password PPP per router; router memverifikasi sertifikat hub | user/password PPP per router |
| Port di hub | UDP `listenPort` (51821) | UDP 500, 4500 | TCP `sstpPort` (default 443) | TCP 1723 + GRE |
| Yang diganti saat pindah hub | endpoint, port, public key | `connect-to`, `ipsec-secret` | `connect-to`, `port` | `connect-to` |

Bersama untuk semua protokol:
- **Nama interface sama** (`netmanager-vpn`), sehingga routing table, rule,
  route (`gateway=netmanager-vpn`, `pref-src=/32`), user API, service API, dan
  `/radius src-address` tidak bergantung protokol.
- **Script menghapus client protokol lain** bernama `netmanager-vpn` (dan
  loopback bila protokol bukan WireGuard), sehingga satu script juga dipakai
  untuk ganti protokol.
- Autentikasi PPP memakai MS-CHAPv2 saja. Username dan password PPP dibuat core
  per router (acak, ≥ 24 karakter), sama di semua hub dalam daftar router, dan
  tidak pernah tampil di daftar router netmanager.
- **SSTP:** core bertindak sebagai CA dan menerbitkan sertifikat server per hub
  dengan `publicHost` hub di SAN (IP atau domain, jadi domain tidak wajib).
  Sertifikat CA disisipkan di script dan di-import di router, lalu client
  memakai `verify-server-certificate=yes` dan
  `verify-server-address-from-certificate=yes`. Tanpa unduhan.
- **PPTP** memakai MPPE 128 bit (`require-encryption`). Tetap dianggap tidak
  aman.

### Auto switch

Scheduler dan aturannya sama dengan rancangan dasar (20 s, dua cek gagal, tanda
gagal 5 menit per `host|port`, jeda 60 s setelah pindah, policy
`read,write,policy,test`). Yang berbeda hanya isi daftar server dan perintah
`set` saat pindah, sesuai tabel di atas. Daftar server L2TP memuat PSK tiap
hub; daftar SSTP memuat port tiap hub.

Ping ke `10.99.0.1` tetap menjadi ukuran sehat. Sesi PPP butuh beberapa detik
untuk login ulang setelah `connect-to` diganti; sasaran ≤ 60 s tetap berlaku
dan harus dibuktikan per protokol.

### Hub

- Hub melayani keempat protokol sekaligus. **Daemon PPP:** accel-ppp (satu
  daemon untuk L2TP, SSTP, PPTP) dan strongSwan untuk IPsec. *(Pilihan saya;
  builder boleh memakai daemon lain bila accel-ppp tidak cocok, selama
  persyaratan di sini terpenuhi.)*
- Pengguna PPP dibaca hub dari state-nya sendiri (diisi core), **bukan** dari
  RADIUS netmanager, supaya VPN tetap service terpisah. Setiap pengguna terikat
  ke `/32` router-nya; sesi diberi alamat itu.
- **L2TP hanya diterima di dalam IPsec.** Paket L2TP (UDP 1701) yang tidak
  datang lewat SA IPsec di-drop oleh hub.
- **Anti-spoof:** paket dari interface PPP yang sumbernya bukan `/32` sesi itu
  di-drop. Aturan forward yang sudah ada untuk `wg-nm` (router hanya ke
  `10.99.0.1` UDP 30812/30813 dan ICMP; router ↔ router di-drop; core dan admin
  → router diizinkan) berlaku sama untuk semua interface PPP, stateless seperti
  sekarang. Accept `DOCKER-USER` ikut mencakup interface PPP.
- **Hub aktif:** hub melaporkan stempel per router seperti handshake WireGuard.
  Untuk sesi PPP, stempelnya adalah waktu terakhir sesi terlihat hidup (diisi
  "sekarang" selama sesi up, dibaca dari daemon). `ChooseActive` di core tidak
  berubah.
- **Kemampuan hub:** hub melaporkan protokol yang bisa dilayaninya (bergantung
  modul kernel dan mode jaringan). Hub WireGuard yang sudah ada di radpro tetap
  hanya WireGuard. Netmanager hanya menawarkan server yang mendukung
  protokol router; core menolak menambah hub yang tidak mendukung protokol
  router ke daftar router itu.
- Satu hub per IP publik untuk L2TP dan PPTP (port tetap). SSTP punya port per
  hub (`sstpPort`).
- **Restart atau upgrade container hub boleh memutus tunnel L2TP/SSTP/PPTP
  satu kali**; client router login ulang sendiri dalam hitungan detik. Berbeda
  dengan WireGuard yang hidup di kernel, daemon PPP mati bersama container.
  Sesi PPPoE pelanggan di router tidak ikut putus, karena RADIUS hanya dipakai
  saat login dan accounting; login atau interim yang jatuh tepat di jeda itu
  diulang oleh router. Jadi daemon PPP dan IPsec boleh berada di container hub
  yang sama. *(Pilihan saya, menggantikan tuntutan "tanpa putus" yang berlaku
  untuk WireGuard.)*

### Hub PPP di radpro

Server pertama untuk L2TP/SSTP/PPTP adalah radpro, jadi hub PPP harus hidup
berdampingan dengan core dan service produksi di host yang sama:
- **Hub terpisah** dari hub WireGuard yang ada, supaya router WireGuard tidak
  tersentuh (sasaran 5). Di netmanager ia tampil sebagai server VPN biasa
  dengan protokol L2TP/SSTP/PPTP. *(Pilihan saya.)*
- Route `/32` sesi PPP tidak boleh bentrok dengan route core ke router
  WireGuard, dan hub tidak menyentuh table `main` host. Mode jaringannya
  (bridge Docker dengan port publish, atau namespace sendiri) diserahkan ke
  builder dan dibuktikan di lab dulu. Bila bridge: PPTP butuh helper NAT PPTP
  (`nf_conntrack_pptp`, `nf_nat_pptp`) agar GRE ikut di-DNAT, dan IPsec harus
  lolos dengan NAT-T di UDP 4500.
- **Port tidak boleh bentrok** dengan yang sudah dipakai radpro. Sebelum
  pemasangan, pemilik menjalankan cek baca-saja di radpro (port 443, 500, 4500,
  1701, 1723 dan modul kernel PPP/IPsec). Hasilnya ada di "Fakta": 443 dipakai
  Traefik, jadi `sstpPort` di radpro adalah port TCP lain yang tidak terpakai
  socket maupun aturan NAT. Perintah instal mengecek kedua hal itu untuk setiap
  port hub dan berhenti dengan pesan jelas bila bentrok, di radpro maupun VPS.
  *(Pilihan saya.)*
- Pemasangan di radpro memakai perintah instal yang sama dengan VPS, dengan
  opsi untuk host yang sudah punya core. Pemilik yang menjalankannya.
- Saat radpro mati, billing dan RADIUS ikut mati, jadi selama hub PPP hanya di
  radpro tidak ada cadangan yang berarti. Cadangan nyata datang dari VPS.

### Perintah instal hub

Tetap satu perintah dari modal "Tambah Server VPN". Tambahan:
- memuat dan mengecek modul kernel: `ppp_generic`, `l2tp_ppp`, `pptp`,
  `ppp_mppe`, dan dukungan xfrm/ESP untuk IPsec. Protokol yang modulnya tidak
  ada dilaporkan tidak tersedia, bukan menggagalkan instal; WireGuard tetap
  wajib seperti sekarang;
- container butuh `/dev/ppp` dan tetap `--network host`;
- bila ufw atau firewalld aktif, port hub dibuka otomatis;
- `upgrade` menambahkan dukungan PPP ke hub WireGuard yang sudah terpasang,
  tanpa join ulang.

### Core

- Router punya `protocol` (`wireguard` default, `l2tp`, `sstp`, `pptp`) dan,
  untuk PPP, kredensial PPP terenkripsi seperti kunci WireGuard sekarang.
- `POST /v1/routers` menerima `protocol`. Endpoint baru untuk ganti protokol
  router; kredensial PPP dibuat saat pertama kali dibutuhkan dan tetap sama
  saat protokol diganti antar PPP.
- `GET /v1/routers/{id}/routeros?part=full|scheduler|switch` merender sesuai
  protokol.
- Hub punya PSK IPsec dan sertifikat SSTP sendiri, disimpan terenkripsi.
- **Ganti PSK adalah tindakan darurat**, bukan pergantian terjadwal: hub
  langsung memakai PSK baru, PSK lama tidak diterima lagi, dan router online
  menerima daftar server baru lewat jalur yang sudah ada. Router yang saat itu
  tidak terjangkau tidak bisa tersambung ke hub tersebut sampai pindah ke hub
  lain di daftarnya atau script ditempel ulang. Netmanager menampilkan daftar
  router yang belum menerima PSK baru. *(Pilihan saya: hub yang menerima dua PSK
  sekaligus dari alamat yang tidak dikenal rumit di IKEv1.)*

### Netmanager

- **Data:** `MikroTikRouter.vpnProtocol` (enum, default `WIREGUARD`, router
  lama otomatis WireGuard). `VpnServer` mendapat protokol yang didukung dan
  `sstpPort`, disinkronkan dari core seperti status sekarang.
- **Form tambah router (mode VPN):** pilihan protokol. Daftar server hanya
  menampilkan server yang mendukung protokol terpilih. Saat PPTP dipilih,
  peringatan tampil di form dan harus dicentang ("Saya mengerti PPTP tidak
  aman") sebelum script bisa dibuat. Modal script dan polling status ("tunnel
  tersambung" → "API tersambung") sama untuk semua protokol.
- **Halaman edit router VPN:** tombol "Ganti protokol" → pilih protokol →
  script baru → tempel → status tersambung. Alamat `/32`, `ipAddress`,
  `nasname`, dan kredensial API tidak berubah.
- **Daftar router:** label protokol per router; PPTP berlabel "Tidak aman".
- **Modal "Tambah Server VPN":** panduan syarat dan port mencantumkan semua
  protokol: UDP `listenPort`; UDP 500 dan 4500; TCP 1723 dan protokol GRE; TCP
  `sstpPort`; keluar ke radpro UDP 51822. Isian `sstpPort` (default 443).

### Pengerjaan bertahap

Setiap tahap bisa dipakai begitu selesai, dan diuji di router lab terhadap
"Ukuran keberhasilan" sebelum tahap berikutnya:
1. **L2TP/IPsec**, termasuk semua bagian bersama: field protokol di netmanager
   dan core, kemampuan hub, perintah instal, panduan port.
2. **SSTP**, termasuk CA core dan sertifikat hub.
3. **PPTP**, termasuk peringatan dan label.

Uji auto switch antar hub untuk L2TP dan PPTP butuh **dua hub di IP publik
berbeda** (port L2TP/PPTP tetap, jadi tidak bisa dua hub di radpro). Selama
hanya ada hub di radpro, tahap L2TP dan PPTP dianggap selesai dengan poin 1–3
"Ukuran keberhasilan"; poin 4 dibuktikan saat VPS pertama ditambah, sebelum
router produksi diberi dua server. SSTP bisa diuji auto switch dengan dua hub
di radpro pada port berbeda.

## Risiko yang diterima

- **PSK L2TP/IPsec dipakai bersama** oleh semua router di satu hub, karena PSK
  ada di script tiap router. Pemilik satu router yang membaca PSK bisa berpura-
  pura menjadi hub bagi router lain, bila ia juga bisa menyadap jalur router
  itu, lalu mendapat hash MS-CHAPv2-nya. Dibatasi dengan rotasi PSK per hub dan
  isolasi antar router di hub. Bila tidak bisa diterima, SSTP (sertifikat
  diverifikasi) adalah pilihan aman untuk router non-WireGuard.
- **PPTP** bisa disadap dan diambil alih di jalur internet. Diterima pemilik,
  dengan peringatan.
- **SSTP lewat TCP** lebih lambat dan sensitif terhadap paket hilang daripada
  WireGuard; tidak masalah untuk API dan RADIUS.

## Yang harus dibuktikan di router lab (v7)

Per protokol, sebelum UI protokol itu dirilis:
1. Script lolos import, dan tempel ulang tidak menggandakan objek.
2. Mengganti protokol lewat tempel script baru tidak meninggalkan sisa protokol
   lama, termasuk saat script ditempel lewat sesi yang berjalan di dalam tunnel
   yang sedang diganti (urutan perintah di script harus membuat ini aman, atau
   panduan menyebut cara yang aman).
3. Poin 1–4 "Ukuran keberhasilan".
4. `set connect-to` (dan `ipsec-secret`, `port`) pada client yang sedang
   tersambung memicu login ulang ke hub baru tanpa me-restart router.
5. SSTP: import CA dari isi script dan verifikasi sertifikat berhasil; client
   menolak sertifikat dari CA lain.
6. Hub menolak L2TP tanpa IPsec, dan menolak sesi PPP yang memalsukan sumber.
7. **Router tanpa IP publik:** router lab di belakang NAT tersambung dengan
   setiap protokol. Dua router di belakang satu NAT yang sama tersambung
   bersamaan dengan L2TP/IPsec. Bila PPTP tidak tembus NAT di lab, peringatan
   PPTP di form menyebutnya.
8. **Versi minimum v7:** versi v7 tertua yang lolos poin 1–6 dicatat. Script
   berhenti dengan pesan jelas di router yang lebih lama, sebelum mengubah apa
   pun. *(Pilihan saya; pemilik tidak tahu versi tertua di lapangan.)*
9. Hub PPP di radpro berjalan tanpa mengganggu core, hub WireGuard, billing,
   dan RADIUS: router WireGuard lab tetap tersambung dan RADIUS tetap menjawab
   selama hub PPP dipasang, di-restart, dan dicabut.

## Diserahkan ke builder

- Daemon PPP dan IPsec yang dipakai, selama persyaratan "Hub" terpenuhi.
- Isi persis script RouterOS per protokol, termasuk MTU/MRU dan cara menyisipkan
  CA, selama aman diulang dan tanpa unduhan.
- Skema state hub/core, format API baru, dan nama field di luar yang disebut.
- Letak persis kontrol di form dan halaman edit, mengikuti komponen yang ada.
