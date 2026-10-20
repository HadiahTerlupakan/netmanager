# VPN untuk akses MikroTik — rancangan

Tanggal: 2026-10-19
Status: rancangan, menunggu persetujuan pemilik

## Tujuan dan alasan

Saat ini netmanager menjangkau setiap MikroTik lewat IP publiknya:
- RouterOS API 8728 tanpa TLS, dipakai untuk cek status, PPP secret, disconnect
  dan provisioning;
- RADIUS (router → NodePort 30812/30813).

Akibatnya port API router harus terbuka ke internet, dan kredensial berjalan tanpa
enkripsi di jalur publik. Router di belakang NAT juga tidak bisa dikelola sama sekali.

Tujuannya: router RouterOS v7 bisa memilih terhubung lewat tunnel WireGuard ke salah
satu dari **banyak server VPN** (VPS sewaan yang bisa ditambah kapan saja), lalu
netmanager mengelolanya lewat IP tunnel yang privat. Router v6 tetap didukung
lewat IP publik seperti sekarang.

## Keputusan pemilik

- **RouterOS v6 tetap didukung.** Form NAS punya toggle "RouterOS v7". Toggle
  "Pakai VPN" hanya muncul kalau v7 menyala, karena WireGuard tidak ada di v6.
- **Server VPN bisa banyak** dan bisa ditambah dengan menyewa VPS baru.
  Pengelolaannya ada di `/admin/tenants`: superadmin menambah server VPN dan
  memilih tenant mana yang boleh memakainya.
- **Di form NAS ada pilihan server VPN** yang akan dipakai router.
- **Script generator VPN** di form NAS menghasilkan satu script siap copas. IP
  Router, Port API, Username API dan Password API terisi otomatis dari hasil
  generate.
- **VPN adalah service terpisah** dari aplikasi netmanager. Deploy netmanager tidak
  boleh memutus tunnel, dan masalah di VPN tidak boleh menjatuhkan aplikasi.
- **Tanpa CHR.**
- **Auto switch di MikroTik client, model "daftar server berurutan"** (pilihan B,
  terinspirasi dari script L2TP billing lain yang dikirim pemilik). Router punya
  satu tunnel dan daftar server sebanyak yang dimiliki tenant. Kalau server yang
  aktif putus, router sendiri yang pindah ke server berikutnya di daftar, dan IP
  router tidak berubah.

## Sasaran

1. Menambah router v7 via VPN dari `/admin/network/mikrotik/new`: pilih server,
   copas script, field terisi sendiri, koneksi terdeteksi otomatis.
2. API, cek status, disconnect, provisioning dan RADIUS berjalan lewat tunnel untuk
   router mode VPN.
3. Superadmin bisa menambah server VPN baru di VPS mana pun dengan satu perintah
   instal (pola copas yang sama dengan MikroTik), lalu membagikannya ke tenant.
4. Deploy atau restart netmanager maupun service VPN tidak memutus tunnel yang
   sedang jalan.
5. Laptop/HP superadmin bisa menjadi peer VPN dan menjangkau semua router lewat IP
   tunnel, untuk Winbox.
6. Router lama dalam mode publik bisa dipindah ke VPN, dan router VPN bisa
   dipindah ke server VPN lain.

## Bukan sasaran (versi pertama)

- **Pembagian beban dan pemilihan server acak.** Urutan daftar menentukan
  pilihan, sehingga perilakunya bisa ditebak.
- **Kembali otomatis ke server pertama.** Router tetap di server tempat ia
  pindah, sampai server itu juga putus atau admin menekan "Kembalikan ke server
  pertama". *(Pilihan saya, untuk mencegah bolak-balik saat server pertama tidak
  stabil.)*
- **VPN untuk RouterOS v6** (L2TP/SSTP/OVPN).
- **Peer VPN untuk admin tenant/mitra.** Peer admin hanya untuk superadmin.
- **Mengganti mekanisme RADIUS/CoA.** Disconnect tetap lewat API.

## Anti-sasaran

- Deploy netmanager membuat tunnel putus atau PPPoE pelanggan gagal login.
- Router satu tenant bisa menjangkau router tenant lain, atau sebuah server VPN
  dipakai router dari tenant yang tidak diberi akses.
- Port kontrol service VPN terjangkau dari internet.
- Memindahkan router (publik → VPN, atau antar server) memutus layanan pelanggan
  karena NAS-IP tidak cocok dengan `nas.nasname`.

## Fakta dari kode yang membatasi rancangan

- Semua koneksi ke MikroTik memakai satu field `MikroTikRouter.ipAddress`
  (`prisma/schema.prisma:652`), dan nilai yang sama disinkronkan menjadi
  `nas.nasname` (`modules/network/repositories/MikroTikRouterRepository.sync.ts:31,76`).
- FreeRADIUS mencari tenant dengan `nasname = '%{NAS-IP-Address}'`
  (`config/radius/sql.conf:81-121`). Source IP paket RADIUS dan NAS-IP-Address
  harus sama dengan `ipAddress`. **Konsekuensinya: server VPN tidak boleh
  me-NAT trafik router, cukup me-route.**
- Alamat RADIUS server yang dipush ke router berasal dari `detectPublicIp()`
  (`modules/network/services/mikrotik-provisioning.ip-detection.ts:32-53`);
  pemanggil selalu mengirim `null`.
- RADIUS di k8s berupa NodePort 30812/30813 dengan `externalTrafficPolicy: Local`
  (`k8s/production/radius-deployment.yaml:86-100`).
- Catch-all client RADIUS `10.42.0.0/16` (pod k3s) dan `172.16.0.0/12` (docker) di
  `config/radius/clients.conf`. Semua subnet VPN harus berada di luar rentang ini.
- Host radpro sudah memakai UDP 51820 dan `10.88.0.0/24` untuk WireGuard tikman.
- Halaman form: `app/admin/network/mikrotik/new/MikrotikNewClient.tsx`,
  `app/admin/network/mikrotik/components/mikrotikRouterForm.tsx`; modal script lama:
  `components/mikrotik/ScriptGeneratorModal.tsx`. Halaman tenant:
  `app/admin/tenants/` (ada `[id]/features`).

## Arsitektur

```
                 ┌──────────── radpro (k3s, netmanager) ────────────┐
                 │  core: wg-core 10.99.0.1                         │
                 │  pod netmanager → semua router (src 10.99.0.1)   │
                 │  NodePort RADIUS ← router (src = IP tunnel router)│
                 └──────▲────────────────▲────────────────▲─────────┘
            backhaul WG │                │                │
                 ┌──────┴─────┐   ┌──────┴─────┐   ┌──────┴─────┐
                 │ hub VPS A  │   │ hub VPS B  │   │ hub radpro │ (opsional:
                 └──▲─────────┘   └──▲─────────┘   └────────────┘  radpro juga hub)
                    └──── satu tunnel aktif ────┘
                 MikroTik v7 (satu IP tetap /32, daftar server, auto switch)
```

### Dua peran, satu program: `netmanager-vpn`

Satu binary Go dengan dua mode. Pola `netlink` + `wgctrl` diambil dari implementasi
WireGuard tikman yang sudah berjalan di produksi. *(Pilihan saya: Go; netmanager
sendiri TypeScript.)*

**`core`** (satu instance, di radpro):
- Interface `wg-core`, alamat `10.99.0.1/24`, UDP 51822. Port 51820 sudah dipakai
  tikman.
- Satu peer per hub. `allowed-ips` peer itu berisi alamat backhaul hub
  (`10.99.0.N/32`) ditambah `/32` setiap router yang **saat ini aktif lewat hub
  itu**.
- **Pengendali sisi core** berjalan setiap 10 detik. Router hanya bicara dengan
  satu hub dalam satu waktu, jadi hub aktif cukup ditentukan dari handshake: core
  menanyakan handshake terakhir router ke semua hub di daftarnya, lalu memasang
  `/32` router di peer hub yang handshake-nya paling baru (dan < 180 s). Dengan
  begitu core mengikuti pilihan router, tanpa menebak. Setiap perpindahan dicatat
  sebagai event, ditampilkan di detail router, dan memicu notifikasi.
- Peer perangkat admin juga dipasang di core (`10.99.128.0/24`) dan bisa menjangkau
  semua router.
- API kontrol untuk netmanager: mendaftarkan, mencabut dan melihat status hub, serta
  mengelola peer admin.

**`hub`** (satu per VPS, bisa juga satu di radpro):
- Interface `wg-nm`, UDP 51821, untuk peer router. `allowed-ips` peer router berisi
  `/32` tetap milik router itu. Router yang sama, dengan kunci yang sama, terdaftar
  sebagai peer di **setiap hub dalam daftarnya**, sehingga router bisa pindah ke
  hub mana pun tanpa menunggu pendaftaran.
- Interface `wg-up` sebagai backhaul ke core.
- Paket di-route, tidak di-NAT, supaya source IP router sampai ke RADIUS apa adanya.
- API kontrol untuk peer router (tabel di bawah), hanya mendengar di alamat
  backhaul-nya (`10.99.0.N:7480`). Dari internet port ini tidak ada, dan netmanager
  memanggilnya lewat core.
- Aturan nftables:
  - router → `10.99.0.1` hanya UDP 30812/30813 dan ICMP;
  - router → router di-drop;
  - `10.99.0.1` dan `10.99.128.0/24` → router diizinkan;
  - selain itu di-drop.

  Aturan forward bersifat **stateless**, tanpa conntrack. Saat failover, jalur
  pergi dan pulang bisa sesaat lewat hub yang berbeda, dan aturan stateful akan
  membuang paket di masa transisi itu.

### Auto switch di MikroTik (bagian dari script yang dicopas)

Script yang dicopas membuat semua bagian berikut, dan aman ditempel ulang:

- **Satu interface WireGuard `netmanager-vpn`** dengan satu peer server. Saat
  pindah, yang diganti hanya `endpoint-address`, `endpoint-port` dan
  `public-key`. WireGuard tidak punya proses login, jadi tunnel hidup lagi pada
  handshake berikutnya, dalam hitungan detik. Router tidak bisa memakai satu peer
  per hub di interface yang sama, karena RouterOS menolak `allowed-address` yang
  tumpang tindih.
- **IP router berupa satu `/32` tetap** di interface loopback (bridge kosong).
  Semua trafik ke server memakai IP ini sebagai source.
- **Routing table khusus `netmanager-vpn`.** Routing rule
  `lookup-only-in-table` dipasang untuk `10.99.0.0/24` dan `10.99.128.0/24`
  (diambil dari script billing lain). Route ke server tidak menyentuh table
  `main`, sehingga tidak bentrok dengan routing, mangle atau policy route milik
  operator.
- **Scheduler `netmanager-vpn-switch`, setiap 20 s:**
  1. Selama 60 s setelah router pindah server (termasuk saat script baru
     ditempel), pemeriksaan dilewati. Core butuh waktu untuk memindahkan `/32`
     router ke hub baru; tanpa jeda ini hub baru bisa ikut ditandai gagal, lalu
     aturan "semua gagal, coba server pertama" mengembalikan router ke hub yang
     baru saja mati.
  2. Ping `10.99.0.1` lewat tunnel sebanyak 5 kali. Kalau balasannya ≥ 4,
     hitungan gagal kembali ke nol dan tidak ada yang dilakukan.
  3. Kalau kurang, hitungan gagal bertambah. Router baru pindah setelah **dua
     pemeriksaan gagal berturut-turut**, supaya satu putaran yang hilang di
     uplink LTE/pedesaan atau restart core yang singkat tidak membuat semua
     router berpindah hub.
  4. Saat itu server aktif ditandai gagal dengan waktu dari
     `[/system resource get uptime]`. Uptime tidak ikut melompat saat jam router
     diubah atau disinkronkan NTP, sehingga tidak ada bug pergantian jam seperti
     di script billing lain. Uptime juga ada di semua v7, dan kembali ke nol saat
     reboot, tepat ketika tanda gagal di variabel global ikut hilang.
  5. Router pindah ke server **berikutnya di daftar** yang tidak ditandai gagal
     dalam 5 menit terakhir. Server aktif dikenali dari host, port dan public
     key sekaligus.
  6. Kalau semua ditandai gagal, router mencoba server pertama lagi.

  Setiap pindah dicatat ke log router dengan topik yang mudah dicari.
- **Daftar server** (hostname/IP, port, public key, urutan) ditulis langsung di
  dalam script scheduler. **Tidak ada `/tool fetch` + `/import` dari server luar**:
  itu sama dengan mengizinkan server menjalankan perintah apa pun di router saat
  script ditempel.
- **Endpoint sebaiknya hostname** (misalnya `vpn1.radpro.id`), agar IP VPS bisa
  diganti lewat DNS tanpa menempel ulang. Spike perlu memastikan RouterOS v7
  me-resolve ulang hostname saat endpoint di-set.
- **Target waktu pindah ≤ 60 s** (dua putaran gagal berturut-turut ditambah handshake).

**Rencana alamat** (tidak bertabrakan dengan `10.42/16`, `10.43/16`, `172.16/12`,
`10.88.0.0/24`):
- Backhaul: `10.99.0.0/24`. Core `.1`, hub `.2`–`.126`.
- Admin: `10.99.128.0/24`.
- Router: `10.100.0.0/14`, satu `/32` per router, sekitar 262 ribu alamat. IP ini
  tidak terikat ke hub, sehingga tetap sama saat auto switch maupun saat
  daftar server diubah.
- Alokasi dilakukan oleh core, sehingga dijamin unik di semua hub.
- Batas per hub ditentukan oleh kapasitas VPS, bukan oleh rencana alamat.

### Deploy dan isolasi

- **Repo, image dan pipeline sendiri** (`netmanager-vpn`), mengikuti pola
  `scripts/deploy/netmanager-deploy.sh`: forced command SSH dengan input SHA.
  *(Pilihan saya: repo terpisah.)*
- **Di radpro**: namespace k8s `netmanager-vpn`, Deployment replica 1 dengan
  `strategy: Recreate`, `hostNetwork: true` dan `NET_ADMIN`. Pod menjalankan `core`
  (dan `hub` kalau radpro juga dijadikan hub). API core di `7480` dilindungi
  bearer token dan aturan nftables yang hanya menerima dari `10.42.0.0/16` dan
  loopback.
- **Di VPS hub**: container Docker `--network host --cap-add NET_ADMIN
  --restart unless-stopped`, dipasang dengan perintah instal dari UI (lihat alur
  di bawah). Syarat VPS: virtualisasi KVM, kernel ≥ 5.6 dengan modul `wireguard`,
  dan IP publik. OpenVZ/LXC tidak didukung, dan perintah instal mengecek syarat
  ini sebelum memasang.
- **Interface WireGuard hidup di namespace jaringan host.** Saat proses mati,
  interface tetap ada dan tunnel tetap jalan. Saat start, proses melakukan
  reconcile idempoten tanpa membuat ulang interface.
- **State per instance** disimpan di SQLite (`/var/lib/netmanager-vpn`), dengan
  private key dienkripsi AES-256-GCM. Cadangan harian disimpan ke
  `/var/backups/netmanager-vpn`. Database netmanager menyimpan registry server dan
  ikatan router–peer, sehingga data hub yang hilang bisa dibangun ulang dari
  netmanager. *(Pilihan saya.)*
- **MTU** `wg-nm` 1420 dan `wg-up` 1380, karena paket router dibungkus dua kali.
  Builder boleh menyesuaikannya setelah diuji.

### API kontrol hub (dipanggil netmanager lewat core)

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/v1/server` | public key, endpoint publik, port |
| `POST` | `/v1/peers` | buat peer router (`label`, `address` /32 dari core, `ref` opsional); tanpa `ref` statusnya `pending` |
| `POST` | `/v1/peers/:id/claim` | ikat peer `pending` ke ID router, jadi `active` |
| `GET` | `/v1/peers/:id` | detail + `lastHandshakeAt`, rx/tx |
| `PATCH` | `/v1/peers/:id` | enable/disable, label |
| `DELETE` | `/v1/peers/:id` | hapus peer |
| `GET` | `/v1/peers/:id/config?format=routeros` | potongan script WireGuard untuk router |
| `GET` | `/healthz` | interface ada, backhaul hidup, reconcile terakhir sukses |

Peer `pending` yang lebih dari 24 jam tidak di-claim akan dihapus otomatis.

Core punya API sendiri untuk:
- `hubs`: daftar, buat token join, cabut, status;
- `routers`: alokasi `/32`, tetapkan daftar hub, baca hub aktif dan riwayat
  perpindahan;
- `admin-peers`: buat, config wg-quick/QR, hapus.

## Perubahan di netmanager

### Data (migrasi Prisma)

- **`VpnServer`**: `id`, `name`, `publicHost`, `listenPort`, `backhaulAddress`,
  `wgPublicKey`, `status` (`pending_install` / `online` / `offline` /
  `disabled`), `lastSeenAt` dan `createdAt`. Data ini global dan tidak terikat
  ke tenant.
- **`TenantVpnServer`**: `tenantId` dan `vpnServerId`, menyatakan tenant mana
  yang boleh memakai server mana.
- **`MikroTikRouterVpnServer`**: `routerId`, `vpnServerId`, `priority` dan
  `hubPeerId`. Ini daftar server berurutan milik satu router.
- **`MikroTikRouter`**, kolom baru yang semuanya nullable atau punya default:
  - `rosVersion` (`V6` / `V7`, default `V6` untuk router lama);
  - `connectionMode` (`PUBLIC` / `VPN`, default `PUBLIC`);
  - `vpnAddress` (`/32` tetap);
  - `vpnActiveServerId` (diisi dari core);
  - `publicIpAddress`.

  `ipAddress` tetap satu-satunya alamat yang dibaca kode koneksi. Untuk router VPN,
  nilainya adalah IP tunnel, sehingga semua jalur koneksi yang ada tidak perlu
  diubah.

### `/admin/tenants` (superadmin)

- **Tab atau bagian "Server VPN" berisi daftar server**: nama, IP publik, status,
  jumlah router, dan handshake terakhir.
- **"Tambah Server VPN"**: isi nama dan IP publik VPS. Modal lalu menampilkan
  **satu perintah instal** untuk dijalankan di VPS sebagai root. Perintah itu
  memasang Docker bila belum ada, menjalankan container `hub` dengan token join
  sekali pakai (berlaku 1 jam), lalu hub otomatis tersambung ke core. Modal mem-polling status sampai "online".
- **Detail tenant** (`/admin/tenants/[id]`): checklist server VPN yang boleh
  dipakai tenant itu.
- **Hapus server** hanya bisa dilakukan kalau tidak ada router yang memakainya.
  Kalau masih ada, tombolnya menampilkan daftar router yang harus dipindah dulu.

### Form NAS `/admin/network/mikrotik/new`

1. **Toggle "RouterOS v7"** (default mati). Kalau mati, form dan modal script
   RADIUS lama berjalan persis seperti sekarang.
2. Kalau toggle v7 menyala, muncul **toggle "Pakai VPN"**. Kalau VPN menyala,
   muncul **daftar "Server VPN"** berisi server yang di-assign ke tenant ini.
   Default-nya semua server online milik tenant, dan admin bisa mencentang dan
   mengurutkan dengan seret. Urutan teratas dicoba pertama. Minimal satu server
   harus dicentang.
3. **`</> SCRIPT GENERATOR` di mode VPN** membuka modal VPN. Saat server dipilih
   atau modal dibuka:
   - core mengalokasikan `/32` tetap untuk router;
   - netmanager membuat draft peer `pending` dengan kunci yang sama di setiap hub
     dalam daftar;
   - netmanager membuat kredensial API acak (username `netmanager-<acak>`,
     password ≥ 24 karakter);
   - modal menampilkan satu script siap tempel berisi:
     - loopback dengan IP tetap;
     - WireGuard ke server pertama;
     - routing table khusus;
     - scheduler auto switch dengan daftar server (lihat "Auto switch di
       MikroTik");
     - grup dan user API dengan `address=10.99.0.1/32`;
     - service `api` aktif, dengan `10.99.0.1/32` ditambahkan ke `address` yang
       sudah ada, bukan menimpanya.

     Script ini aman ditempel ulang.
   - Kredensial disusun di netmanager. Hub tidak pernah melihat kredensial API.
   - Membuka modal lagi di form yang sama menampilkan script yang sama. Mengganti
     server membuang draft lama dan membuat draft baru.
4. **Field terisi otomatis dan terkunci**: IP Router = IP tunnel, Port API = 8728,
   Username/Password API = hasil generate. Password bisa ditampilkan dan disalin.
5. **Setelah script ditempel**, modal mem-polling status: "menunggu script
   ditempel" → "tunnel tersambung" → "API tersambung". Saat API tersambung, test
   koneksi otomatis dijalankan. Test itu gagal kalau versi < 7. Kalau 2 menit
   tanpa handshake, modal menampilkan petunjuk: pastikan RouterOS v7 dan VPS
   bisa dijangkau.
6. **Admin menekan "Tambahkan Router"** seperti biasa, karena router tidak
   disimpan otomatis. *(Pilihan saya: nama dan isolir URL masih diisi admin.)*
   Saat disimpan:
   - router tersimpan dengan `connectionMode=VPN`;
   - peer di-claim;
   - auto-configure lama berjalan lewat tunnel, dengan `/radius` ke `10.99.0.1`
     dan `src-address=<IP tunnel>`.
7. Endpoint baru:
   - `POST /api/mikrotik-routers/vpn-draft`
   - `GET /api/mikrotik-routers/vpn-draft/:peerId/status`
   - `GET /api/vpn-servers` (server milik tenant, untuk dropdown)
   - `POST /api/mikrotik-routers` menerima `rosVersion`, `connectionMode`,
     `vpnServerId` dan `vpnPeerId`.

   Server memvalidasi bahwa server VPN itu memang di-assign ke tenant pemanggil.

### Router lama dan pindah server (halaman edit)

- **"Aktifkan VPN"** (khusus router v7 mode publik): pilih server, lalu tempel
  script. Kredensial lama tetap dipakai dan `10.99.0.1/32` ditambahkan ke
  `address` user dan service API. Setelah handshake dan API OK, tekan **"Pindahkan
  ke VPN"**:
  - `ipAddress` lama disimpan ke `publicIpAddress`, lalu `ipAddress` diisi IP
    tunnel;
  - `nasname` ikut berubah;
  - router di-provision ulang (`/radius` ke `10.99.0.1` dengan `src-address`).

  Langkah ini atomik: kalau provisioning gagal, semuanya dikembalikan.
- **"Kembali ke publik"** membalik langkah di atas.
- **Ubah daftar server** (tambah, hapus, urutkan): **tidak perlu tempel ulang.**
  Netmanager sudah punya akses API ke router lewat tunnel, jadi ia:
  1. mendaftarkan peer di hub baru;
  2. memperbarui daftar di script scheduler router lewat API;
  3. menghapus peer di hub yang dikeluarkan.

  IP router dan `nasname` tidak berubah.
- **Server baru di-assign ke tenant**: admin bisa menambahkannya ke semua router VPN
  tenant itu sekaligus, dengan langkah yang sama di latar belakang. Router yang
  sedang tidak terjangkau dicoba lagi saat tersambung.
- **Detail router menampilkan** daftar server, server yang sedang aktif, riwayat
  auto switch, dan tombol **"Kembalikan ke server pertama"**. Tombol ini memakai
  API untuk mengganti endpoint di router.
- **Panduan menutup akses publik** (`/ip/service set api,winbox,ssh
  address=...`) hanya ditampilkan dan tidak dijalankan otomatis, karena salah
  satu baris saja bisa membuat admin terkunci di luar router.

### Status dan alamat RADIUS

- **Status router saat tunnel putus.** Router VPN yang tidak punya handshake segar
  di hub mana pun selama lebih dari 3 menit tampil **"tunnel putus"**, bukan
  "offline", dan tidak memicu notifikasi offline ganda. Router yang aktif bukan di
  server pertama tetap online, dengan tanda "berjalan di server cadangan".
- **Hapus server VPN** ditolak selama server itu masih ada di daftar router mana
  pun. UI menawarkan "keluarkan dari semua router" lebih dulu.
- **Alamat RADIUS untuk provisioning.** Router mode VPN memakai `10.99.0.1` (env
  `VPN_CORE_ADDRESS`). Router publik tetap memakai `detectPublicIp()`.
- **Env/Secret di `k8s/production`**: `VPN_CORE_API_URL`, `VPN_API_TOKEN` dan
  `VPN_CORE_ADDRESS`.

## Yang harus dibuktikan dulu (spike, sebelum UI)

Uji manual dengan satu VPS hub dan satu router uji v7:
1. Pod k3s di radpro bisa login API ke router lewat core → hub, dan router melihat
   source `10.99.0.1`.
2. RADIUS dari router ke `10.99.0.1:30812` sampai ke pod radius dengan source =
   IP tunnel router (tanpa NAT di hub, `externalTrafficPolicy: Local`). PPPoE uji
   bisa login, dan accounting tercatat ke router yang benar.
3. Restart container hub dan pod core tidak memutus sesi PPPoE maupun API.
4. Latensi RADIUS lewat dua tunnel masih jauh di bawah timeout 3000 ms.
5. Dengan dua VPS hub: matikan container hub pertama (dan dalam uji terpisah,
   matikan VPS-nya), lalu pastikan:
   - scheduler router pindah ke hub kedua dalam ≤ 60 s;
   - core memindahkan `/32` ke hub kedua dalam ≤ 20 s setelah handshake baru;
   - sesi PPPoE yang aktif tidak putus;
   - login PPPoE baru dan accounting berjalan selama di hub kedua.

   Setelah hub pertama hidup lagi, router tetap di hub kedua. "Kembalikan ke
   server pertama" dari UI berhasil.
6. Di RouterOS v7, pastikan:
   - `set` pada `endpoint-address`, `endpoint-port` dan `public-key` peer
     WireGuard berlaku tanpa me-restart interface;
   - hostname di endpoint di-resolve ulang saat di-set;
   - selisih dua nilai `[/system resource get uptime]` bisa dibandingkan dengan
     `00:05:00` dan `00:01:00` di versi v7 terendah yang didukung.

Kalau poin 2 gagal, alternatifnya adalah pod radius dengan `hostNetwork`. Itu
perubahan di netmanager dan menjadi keputusan pemilik.

## Diserahkan ke builder

- Struktur kode Go, skema SQLite, dan format respons di luar field di atas.
- Pemakaian `google/nftables` atau memanggil `nft`.
- Isi persis script RouterOS dan perintah instal hub, selama aman diulang.
- Letak persis tab "Server VPN" di `/admin/tenants`, mengikuti komponen yang ada.
