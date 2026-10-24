# netmanager-vpn

Layanan VPN WireGuard untuk router MikroTik yang dikelola netmanager. Satu
biner Go menjalankan dua peran: core di radpro dan hub di VPS regional.
Router terhubung ke hub terdekat, hub meneruskan trafik ke core lewat backhaul
`10.99.0.0/24`, dan core memilih hub aktif dari handshake terbaru.

## Mode

- `-mode core`: registri hub, router, dan perangkat admin; mengelola `wg-core`
  (UDP 51822) dan API kontrol di port 7480.
- `-mode hub`: `wg-nm` (UDP 51821, atau port yang dipilih saat hub dibuat) untuk router dan `wg-up` ke core; API hanya
  di alamat backhaul-nya dan hanya menerima dari `10.99.0.1`.

Subcommand: `hub join <bundle>` (sekali, saat instal hub) dan
`backup <dir>` (salinan `state.db`).

## Variabel lingkungan

| Variabel | Core | Hub | Isi |
| --- | --- | --- | --- |
| `NMVPN_ENCRYPTION_KEY` | wajib | wajib | 32 byte base64; mengenkripsi private key di SQLite |
| `NMVPN_API_TOKEN` | wajib | - | bearer token API kontrol |
| `NMVPN_CORE_ENDPOINT` | wajib | - | `host:port` publik wg-core |
| `NMVPN_INSTALL_URL` | wajib | - | URL `install-hub.sh` untuk perintah instal |
| `NMVPN_HUB_IMAGE` | wajib | - | image hub dengan tag atau digest persis; `:latest` ditolak. Diisi manifes dari image core sendiri, bukan dari Secret |
| `NMVPN_STATE` | opsional | opsional | default `/var/lib/netmanager-vpn/state.db` |

Pada hub, token API disimpan dari bundle join, bukan dari env.

## Deploy core

Core berjalan di k3s radpro (`deploy/k8s/core.yaml`, namespace
`netmanager-vpn`, `hostNetwork`, `NET_ADMIN`). Secret `netmanager-vpn-secrets`
(kunci di atas, tanpa `NMVPN_HUB_IMAGE`) dan `netmanager-vpn-registry` dibuat manual; repo tidak
menyimpannya. Deploy:

```
ssh radpro-vpn-deploy <sha-40>
```

`deploy/netmanager-vpn-deploy.sh` terpasang di host sebagai forced command. Ia
menurunkan tag image dari SHA, mengambil manifes dari commit itu, menjalankan
`backup`, lalu `kubectl apply` dan menunggu rollout. `REPO_GITHUB` dan
`REGISTRY` di bagian atas skrip masih nilai rencana sampai repo GitHub dibuat.

User deploy menjalankan `sudo -n` untuk tiga perintah, jadi butuh baris
sudoers ini (ganti `deploy` dan `1001` dengan nama dan UID user itu; skrip
memberi `-o` berupa UID numerik):

```
deploy ALL=(root) NOPASSWD: /usr/local/bin/kubectl, \
  /usr/bin/install -d -o 1001 -m 700 /run/netmanager-vpn-deploy, \
  /usr/bin/find /var/backups/netmanager-vpn -maxdepth 1 -name state-*.db -mmin *
```

Skrip ini tidak memakai `crictl`, berbeda dengan skrip netmanager yang
membersihkan image lama, jadi `crictl` tidak perlu diberikan.

## Pasang hub

Perintah instal dibuat tab VPN di netmanager saat hub ditambahkan, berbentuk
(`$(command -v sudo)` kosong di VPS yang login sebagai root tanpa sudo):

```
curl -fsSL <install-url> | $(command -v sudo) env NMVPN_IMAGE=<image> sh -s -- <bundle>
```

Image harus bisa di-pull tanpa login dari VPS hub, jadi paket GHCR-nya harus
public; kalau tidak, instal gagal di `docker pull`.

Bundle memuat kunci hub dan hanya berlaku 1 jam. Skrip meneruskannya ke
container lewat stdin, tetapi bundle tetap ada di perintah `curl ... | sh -s --
<bundle>` yang ditempel operator, sehingga masuk riwayat shell VPS. Awali
perintah dengan spasi atau hapus barisnya dengan `history -d`. VPS harus KVM (bukan OpenVZ
atau LXC), kernel 5.6 atau lebih baru, dan Debian/Ubuntu bila Docker belum
terpasang. Skrip memasang `netmanager-vpn-hub` sebagai container dengan
`--restart unless-stopped`; kunci enkripsi hub dibuat sekali di
`/etc/netmanager-vpn/env`.

## Upgrade hub

Setelah core di-deploy dengan image baru, hub ikut dipindah ke image yang sama.
Ambil perintahnya dari `GET /v1/hubs/{id}/upgrade-command` (text/plain):

```
curl -fsSL <install-url> | $(command -v sudo) env NMVPN_IMAGE=<image> sh -s -- upgrade
```

Mode `upgrade` mensyaratkan `/etc/netmanager-vpn/env` dan
`/var/lib/netmanager-vpn/state.db` dari instalasi sebelumnya, tidak menjalankan
join (kunci dan peer tetap), lalu pull image dan membuat ulang container.
Router di hub itu putus selama container dibuat ulang, beberapa detik; upgrade
hub satu per satu agar router bisa pindah ke hub lain di daftarnya.

## Hub L2TP di radpro

Hub L2TP di radpro adalah hub terpisah dari hub WireGuard yang sudah ada. Ia
dibuat di netmanager lewat "Tambah Server VPN" dengan `publicHost` `31.56.30.53`
dan port WireGuard yang belum terpakai (51821 hub A dan 51823 hub B sudah
dipakai; contoh: 51824). Perintah instal dari modal tidak dijalankan di radpro;
hanya bundle-nya yang dipakai.

Kenapa dipasang manual sebagai container bridge:

- radpro kernel 5.15, menjalankan k3s dan Docker. Hub WireGuard yang ada juga
  container bridge, bukan host network, sehingga rute /32-nya tidak bentrok
  dengan core di host yang sama. Hub L2TP mengikuti pola itu.
- TCP 443 di radpro dipegang Traefik (DNAT), jadi tidak ada SSTP di sana.

Langkah (ganti `<wgport>`, `<image>`; state di `/var/lib/netmanager-vpn-hub-l2tp`,
env di `/etc/netmanager-vpn-hub-l2tp/env`):

0. Periksa dulu bahwa port belum dipakai dan container belum ada. Ketiga
   perintah harus tidak mencetak apa pun:

   ```
   sudo ss -Hlnu | grep -E ':(500|4500|<wgport>)\b'
   sudo iptables-save -t nat | grep -E -- '--dports? ([^ ]*[,:])?(500|4500|<wgport>)([ ,:]|$)'
   sudo docker ps -aq --filter name=^netmanager-vpn-hub-l2tp$
   ```

   Aturan iptables yang memakai rentang port (misalnya `400:600`) tidak
   tertangkap; bila ragu, baca keluaran `iptables-save -t nat` dengan mata.

   Buka UDP `<wgport>`, 500 dan 4500 di firewall provider radpro, dan di
   firewall host bila aktif.

1. Muat modul host sekali, lalu buat bertahan reboot:

   ```
   sudo modprobe -a ppp_generic l2tp_ppp l2tp_netlink esp4 xfrm_user af_key nft_fib_inet nft_xfrm
   printf '%s\n' ppp_generic l2tp_ppp l2tp_netlink esp4 xfrm_user af_key nft_fib_inet nft_xfrm \
     | sudo tee /etc/modules-load.d/netmanager-vpn-ppp.conf
   ```

2. Buat direktori state dan env sendiri (mode 700) dan file `env` (mode 600)
   berisi `NMVPN_ENCRYPTION_KEY`, dibuat seperti `install-hub.sh`
   (`head -c 32 /dev/urandom | base64`). Perintah ini tidak mencetak kunci:

   ```
   sudo install -d -m 700 /var/lib/netmanager-vpn-hub-l2tp /etc/netmanager-vpn-hub-l2tp
   sudo sh -c 'umask 077; printf "NMVPN_ENCRYPTION_KEY=%s\n" "$(head -c 32 /dev/urandom | base64)" > /etc/netmanager-vpn-hub-l2tp/env'
   ```

   Jangan jalankan langkah ini lagi untuk hub yang sudah ada: kunci baru
   membuat state tersimpan tidak terbaca. Upgrade memakai file env yang sama.
   Kunci di file env terlihat lewat `docker inspect` bagi siapa pun yang punya
   akses docker atau root di radpro; ini bawaan `--env-file` dan sama untuk hub
   A dan B.

3. Join (sekali). Bundle berasal dari perintah instal yang ditampilkan "Tambah
   Server VPN": argumen panjang setelah `sh -s --`. Simpan ke berkas sementara
   bermode 600; jangan lewat argumen perintah atau riwayat shell:

   ```
   (
     umask 077; f=$(mktemp); trap 'rm -f "$f"' EXIT
     cat > "$f"    # tempel bundle, lalu Ctrl-D
     sudo docker run -i --rm --cap-add NET_ADMIN --sysctl net.ipv4.ip_forward=1 \
       -v /var/lib/netmanager-vpn-hub-l2tp:/var/lib/netmanager-vpn \
       --env-file /etc/netmanager-vpn-hub-l2tp/env \
       <image> hub join - < "$f"
   )
   ```

4. Jalankan:

   ```
   sudo docker run -d --name netmanager-vpn-hub-l2tp --restart unless-stopped \
     --cap-add NET_ADMIN --sysctl net.ipv4.ip_forward=1 --device /dev/ppp \
     -p <wgport>:<wgport>/udp -p 500:500/udp -p 4500:4500/udp \
     --env-file /etc/netmanager-vpn-hub-l2tp/env \
     -v /var/lib/netmanager-vpn-hub-l2tp:/var/lib/netmanager-vpn \
     <image> -mode hub
   ```

5. Cek: `sudo docker logs netmanager-vpn-hub-l2tp` tidak boleh memuat "hub serves
   WireGuard only". Di netmanager, server itu harus menampilkan protokol yang
   mencakup `l2tp`. Core mengambilnya pada sinkron core berikutnya.
6. Tetapkan server ini hanya ke tenant uji sampai uji lab lulus. Jangan
   tetapkan ke tenant produksi sebelum rencana rotasi PSK darurat selesai.

Upgrade: pull image baru, hapus container, lalu jalankan langkah 4 lagi.
Direktori state menyimpan kunci, PSK, dan peer; file env tidak dibuat ulang.

```
sudo docker pull <image>
sudo docker rm -f netmanager-vpn-hub-l2tp
```

Restart hub memutus tunnel L2TP sekali; router menyambung ulang dalam beberapa
detik dan PPPoE pelanggan tidak terpengaruh.

Mencabut: pindahkan dulu semua router L2TP dari server ini (ganti protokolnya,
atau tetapkan server L2TP lain), hapus server di netmanager, lalu:

```
sudo docker rm -f netmanager-vpn-hub-l2tp
sudo rm -rf /var/lib/netmanager-vpn-hub-l2tp /etc/netmanager-vpn-hub-l2tp
```

Ini menghancurkan kunci hub ini. Periksa lagi path-nya agar direktori hub A
dan B (`/var/lib/netmanager-vpn`, `/var/lib/netmanager-vpn-hub-b`) tidak
tersentuh. Modul boleh tetap dimuat.

Di VPS (bukan radpro), perintah instal satu baris dari modal "Tambah Server VPN"
kini juga memuat modul, menambah `/dev/ppp`, memeriksa bentrok port (socket dan
NAT), dan membuka ufw/firewalld.

Batas tahap 1:

- Failover L2TP antar hub butuh server kedua dengan IP berbeda; belum diuji
  sampai ada VPS.
- Skrip L2TP butuh RouterOS 7.24.5 atau lebih baru.
- Router di belakang CGNAT belum diuji di lab.

## Mengganti daftar server router

Router hanya mengenal hub yang tertulis di script `netmanager-vpn-switch`-nya.
netmanager harus memakai urutan ini, jangan pernah mengganti hub aktif dalam
satu `PUT`:

1. `PUT /v1/routers/{id}/hubs` dengan daftar lama ditambah hub baru.
2. Perbarui script `netmanager-vpn-switch` di router lewat API RouterOS
   (`/system/script/set source=` dengan isi `routeros.SwitchSource`), atau
   jalankan `GET /v1/routers/{id}/routeros?part=scheduler` di router.
3. Baru setelah itu `PUT` lagi tanpa hub lama.

Bila hub lama dicabut lebih dulu, peer router di hub itu dihapus sementara
router masih memakainya, dan router terputus sampai auto switch memindahkannya.

## Integrasi netmanager

Aplikasi netmanager memanggil API core lewat `VpnCoreClient`
(`modules/network/vpn/`). Tiga variabel mengaturnya. Fitur VPN tersembunyi
kecuali `VPN_CORE_API_URL` **dan** `VPN_API_TOKEN` sama-sama terisi; salah
satu kosong berarti layanan VPN dianggap belum dikonfigurasi.

| Variabel | Letak | Isi |
| --- | --- | --- |
| `VPN_CORE_API_URL` | ConfigMap `netmanager-config` | URL API core. Kosong (default) menyembunyikan fitur VPN |
| `VPN_API_TOKEN` | Secret `netmanager-secrets`, `optional: true`, hanya di pod app dan worker | Sama dengan `NMVPN_API_TOKEN` core. Kosong juga menyembunyikan fitur VPN. `optional` agar pod tetap start sebelum Secret diisi |
| `VPN_CORE_ADDRESS` | ConfigMap | Alamat core di backhaul, default `10.99.0.1`; hanya IPv4 |

Urutan rollout:

1. Deploy core netmanager-vpn (bagian "Deploy core").
2. Isi token API core ke `netmanager-secrets` sebagai `VPN_API_TOKEN`.
3. Isi `VPN_CORE_API_URL` di ConfigMap: `http://netmanager-vpn.netmanager-vpn.svc.cluster.local:7480`
   (Service core; pod app sampai ke sana tanpa NetworkPolicy tambahan).
4. Deploy netmanager; migrasi `20261020090000_add_vpn_servers` dijalankan job migrasi.
5. Tambahkan server di `/admin/tenants`.
6. Tetapkan server itu ke tenant.

Set `RADIUS_PUBLIC_IP`. Tombol "Kembali ke publik" menolak alamat yang hanya
ditebak dari interface lokal (sumber `local` di deteksi IP publik), karena
alamat itu bisa salah dan router akan menunjuk ke IP yang tak terjangkau.

`VpnServer`, `MikroTikRouterVpnServer`, dan `VpnCoreRouterTombstone` ada di
`lib/prisma-ignore-models.ts`, jadi tidak diisolasi per tenant oleh
`withTenantIsolation`. Ketiganya tidak punya kolom `tenantId`: server VPN dipakai
bersama oleh beberapa tenant lewat `TenantVpnServer`, dan dua lainnya mengikuti
router. Akses dari rute tenant selalu lewat induk yang sudah difilter tenant
(`TenantVpnServer` atau `MikroTikRouter`); sisanya hanya dari rute admin.

Belum selesai: snippet RouterOS yang dibuat netmanager masih sementara sampai
spike selesai (`docs/superpowers/plans/2026-10-19-vpn-spike.md`).

## Router ber-nama host

`ipAddress` router harus alamat IP literal (create, PATCH yang mengubahnya,
test koneksi, dan pindah ke VPN). Router PUBLIC lama yang berisi nama host
tetap berjalan, tetapi harus diganti IP sebelum bisa test koneksi atau pindah
ke VPN. Daftar sebelum deploy (hanya baca). Yang lolos hanya IPv4 kanonik
(oktet 0-255 tanpa nol di depan) dan bentuk yang mungkin IPv6 (berisi `::` atau
minimal dua titik dua, bukan `IPv4:port`); sisanya, termasuk `010.1.1.1`,
`999.1.1.1`, dan `1.2.3.4:8728`, ditolak kode dan ikut terdaftar. Query ini
tidak memfilter `connectionMode`: kolom itu baru dibuat migrasi
`20261020090000_add_vpn_servers`, dan sebelum deploy semua router masih
publik.

```sql
SELECT id, name, "tenantId", "ipAddress"
FROM "MikroTikRouter"
WHERE NOT (
    "ipAddress" ~ '^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$'
    OR ("ipAddress" ~ '^[0-9A-Fa-f:.]+$'
        AND ("ipAddress" LIKE '%::%' OR "ipAddress" ~ ':.*:')
        AND "ipAddress" !~ '^[0-9.]+:[0-9]+$')
  );
```

## Server untuk semua router

Superadmin punya dua aksi massal: "Tambahkan ke semua router VPN" di halaman VPN
tenant dan "Keluarkan dari semua router" di modal hapus server. Keduanya hanya
mengubah DB. Pengiriman daftar server ke router dilakukan retry monitor 5 menit:
maksimal 20 router per tenant per siklus, hanya router online; router offline
menerimanya saat tersambung kembali. Router yang server satu-satunya itu
dilewati dan didaftar. Hapus server tetap diblokir sampai semua router menerima
daftar barunya.

Pengiriman daftar per router diserialkan dengan advisory lock Postgres; perubahan
bersamaan dijawab 409 "Daftar server router ini sedang diperbarui, coba lagi
sebentar". Tulis RouterOS VPN dibatasi 15 detik. Badge "Server cadangan" di
daftar router berasal dari monitor yang membaca hub aktif tiap router VPN dari
core sekali per siklus 5 menit (maksimal 20 lookup serentak).

## Firewall provider

- radpro: buka UDP 51822 (wg-core). Hub L2TP di radpro memakai port WireGuard sendiri, ditambah UDP 500 dan 4500 (lihat "Hub L2TP di radpro").
- Setiap hub: buka UDP 51821 (wg-nm), atau port yang dipilih saat hub dibuat. Koneksi keluar ke radpro UDP 51822 harus diizinkan.
- Hub dengan L2TP/IPsec di VPS: UDP port server, UDP 500, UDP 4500, ditambah keluar UDP 51822 ke core.
- Port 7480 tidak pernah dibuka ke internet.

Docker memasang policy `FORWARD DROP` di iptables, dan `accept` di tabel nft
kita tidak bisa membatalkan drop dari base chain lain. Karena itu hub (dan core,
bila radpro menjalankan Docker) menyisipkan accept untuk interface WireGuard di
chain `DOCKER-USER` setiap reconcile: hub `-i wg-nm -o wg-up` dan
`-i wg-up -o wg-nm`, core `-i wg-core -o wg-core`. Tanpa Docker chain itu tidak
ada dan langkah ini dilewati. Drop di tabel nft tetap berlaku.

## Cadangan

`netmanager-vpn backup <dir>` menulis `state-YYYYMMDD-HHMMSS.db` dengan
`VACUUM INTO` dan menghapus `state-*.db` yang lebih dari 7 hari. Core: CronJob
harian 03:15 ke `/var/backups/netmanager-vpn` di radpro. Hub: cron harian ke
`/var/lib/netmanager-vpn/backups`.
