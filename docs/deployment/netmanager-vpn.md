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

## Firewall provider

- radpro: buka UDP 51822 (wg-core).
- Setiap hub: buka UDP 51821 (wg-nm). Koneksi keluar ke radpro UDP 51822 harus diizinkan.
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
