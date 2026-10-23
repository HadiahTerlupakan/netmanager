# VPN Multi-Protokol Tahap 1 (L2TP/IPsec) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Router VPN bisa memilih WireGuard atau L2TP/IPsec. Hub pertama yang melayani L2TP berjalan di radpro, dan semua bagian bersama yang nanti dipakai SSTP/PPTP ikut dibangun.

**Architecture:** Core netmanager-vpn menyimpan protokol per router, membuat kredensial PPP per router dan PSK IPsec per hub, lalu mengirimkannya ke hub lewat API peer yang sudah ada. Hub menjalankan strongSwan dan daemon PPP sebagai proses anak, melaporkan protokol yang sanggup dilayaninya, dan memberi stempel "terakhir terlihat" untuk sesi PPP. Dengan begitu `ChooseActive` dan auto switch tidak berubah. Netmanager hanya menambah pilihan protokol, yang mengalir lewat draft, simpan router, ganti protokol, dan "kembali ke server pertama".

**Tech Stack:** Go 1.26 (netmanager-vpn: SQLite, nftables, wgctrl, netlink), strongSwan dan daemon PPP di image Alpine, Next.js/Prisma/zod/vitest (netmanager).

**Spec:** `docs/superpowers/specs/2026-10-23-vpn-multi-protocol-design.md` (repo netmanager, commit 006095aec).

**Repo:**
- Bagian A dan C: `~/Documents/radpro/netmanager-vpn`, branch `feat/l2tp`.
- Bagian B: `~/Documents/radpro/netmanager`, branch `feat/vpn-l2tp`, dibuat dari `main` setelah branch `docs/vpn-multi-protocol` di-merge.

**Di luar plan ini:**
- SSTP (tahap 2) dan PPTP (tahap 3).
- Uji pindah hub L2TP, yang menunggu VPS kedua.
- Rotasi PSK darurat beserta daftar router yang belum menerimanya (spec, bagian "Core"). Rotasi ini mendapat plan kecil sendiri, dan wajib selesai sebelum server L2TP ditetapkan ke tenant produksi.

## Global Constraints

- Yang diuji dan dijamin hanya RouterOS v7. Toggle "Pakai VPN" tetap hanya untuk v7.
- Nilai protokol di core: `wireguard` (default) dan `l2tp`. Di netmanager: enum `VpnProtocol { WIREGUARD L2TP }`. SSTP dan PPTP **tidak** dibangun di plan ini.
- Nama interface router selalu `netmanager-vpn`. Routing table, rule, dan route tetap seperti sekarang (`gateway=netmanager-vpn`, `pref-src=/32`).
- Router L2TP tidak memakai loopback `netmanager-lo`. Alamat `/32` diberikan hub lewat PPP.
- Script tidak mengunduh atau meng-import apa pun (`/tool fetch`, `/import` dilarang).
- PPP: hanya MS-CHAPv2. Username `nmvpn-<id router core>`. Password 24 byte acak, base64url (32 karakter). Keduanya dibuat sekali dan tetap sama saat protokol diganti antar-PPP.
- PSK IPsec per hub: 32 byte acak, base64url (43 karakter). Disimpan tersegel di core dan di hub.
- L2TP diterima hub hanya di dalam IPsec. UDP 1701 tanpa IPsec di-drop.
- Anti-spoof: paket dari `ppp*` yang sumbernya tidak dirutekan kembali lewat interface itu di-drop.
- Aturan forward `wg-nm` berlaku sama untuk `ppp*`.
- Password API router, password PPP, PSK, dan kunci privat tidak pernah di-log dan tidak masuk repo.
- Router WireGuard yang sudah berjalan tidak tersentuh:
  - `scheduler.rsc` WireGuard dan `SwitchSource` WireGuard byte-identik dengan sekarang;
  - API peer hub tetap menerima body lama (`{address}` = WireGuard).
- Core dan hub harus kompatibel beda versi. Core baru dengan hub lama: `/v1/info` dan `/v1/ipsec` 404, dan hub dianggap WireGuard saja. Hub baru dengan core lama: body peer tanpa `protocol` dianggap WireGuard.
- Perubahan di radpro dijalankan pemilik dengan `!`, bukan oleh builder. Builder menyiapkan skrip di scratchpad.
- Push ke `main` netmanager men-deploy produksi. Merge dan push hanya atas izin pemilik.
- netmanager-vpn: README tetap kosong. Dokumentasi infra masuk ke repo netmanager.
- Batas ukuran:
  - netmanager-vpn: file maksimal sekitar 300 baris dan fungsi maksimal sekitar 50 baris, mengikuti gaya repo.
  - netmanager: file maksimal 350 baris. File yang mendekati batas dipecah, bukan diperpanjang (`mikrotikRouterTable.tsx` 331, `mikrotikFormShared.ts` 304, `mikrotik-router.mutations.ts` 342).

## Review Focus

1. **Hub WireGuard lama yang belum di-upgrade.** Core tetap mengizinkan router WireGuard di hub itu, menolak router L2TP di sana, dan pass sync tidak gagal karena 404. Tes: `TestSyncToleratesHubWithoutInfo` (Task 6).
2. **Ganti protokol saat sesi lama masih hidup.** Setelah peer diubah dari `l2tp` ke `wireguard`, hub memutus sesi PPP-nya dan mengembalikan route `/32` ke `wg-nm`. Sebaliknya, allowed-IP `wg-nm` untuk router itu hilang. Tes: `TestUpsertPeerProtocolChangeTerminatesSession` (Task 4).
3. **Draft lama dipakai ulang padahal protokol di form sudah diganti.** Draft WireGuard tidak boleh dipakai untuk router L2TP. Tes: `reusePrevious menghapus draft bila protokol berbeda` (Task 9).
4. **Server kehilangan kemampuan L2TP**, misalnya hub restart tanpa `/dev/ppp`. Sync netmanager menghapus `l2tp` dari daftar protokolnya, form berhenti menawarkannya, dan core menolak router L2TP baru di hub itu. Tes: `TestValidateHubIDsRejectsHubWithoutProtocol` (Task 6) dan `hubFields menyalin protocols` (Task 8).
5. **Rahasia berisi karakter yang merusak script.** PSK atau password yang memuat `|`, `"`, `$`, atau `?` harus ditolak `Validate` atau di-escape. Tes: `TestValidateRejectsSecretWithSeparator` (Task 2).

## Rulings

Diambil saat menulis plan. Executor mencatatnya di ledger.

- **R1: Ganti protokol memakai urutan "tempel dulu, lalu Terapkan"** — memenuhi lab spec poin 2: tempel lewat tunnel lama tetap aman.
  - Netmanager meminta script protokol baru dari core tanpa mengubah apa pun (`protocol-script`). Teknisi menempelnya: client baru dibuat dulu, client lama dihapus di baris terakhir. Teknisi lalu menekan "Terapkan", dan baru saat itu core memindah router di hub.
  - Jeda antara tempel dan Terapkan membuat router offline sebentar, dan UI menyebutnya.
  - Biaya bila salah: satu kali tempel ulang.
- **R2: PSK dikirim core ke hub lewat `PUT /v1/ipsec`**, bukan lewat join bundle. Hub lama yang di-upgrade mendapat PSK tanpa join ulang, sesuai sasaran spec "upgrade tanpa join ulang".
- **R3: Hub melaporkan kemampuan lewat `GET /v1/info`.** Core membacanya di `SyncPending` dan menyimpannya di `hubs.protocols`.
- **R4: Stempel sesi PPP dibaca dari kernel, bukan dari daemon.** Interface `ppp*` yang UP dengan alamat peer = `/32` router berarti router terlihat "sekarang". Cara ini tidak bergantung daemon mana yang dipilih spike.
- **R5: Gerbang rilis L2TP adalah penetapan server.** Netmanager menawarkan L2TP hanya untuk server yang melaporkan `l2tp`, dan server hanya terlihat oleh tenant yang ditetapkan superadmin. Selama uji lab, hub PPP radpro hanya ditetapkan ke tenant uji, jadi tidak perlu feature flag.
- **R6: Panel "aktifkan VPN" untuk router PUBLIC v7 ikut mendapat pilihan protokol**, karena itu form tambah router untuk router yang sudah ada.
- **R7: Nilai sementara, dipastikan spike (Task 1):** MTU/MRU L2TP 1380 (muat di `wg-up` 1380), proposal IPsec, dan versi minimum v7. Bila spike menemukan nilai lain, nilai spike yang dipakai dan dicatat sebagai ruling.

---

## Bagian A — netmanager-vpn

### Task 1: Spike L2TP/IPsec di radpro (throwaway, dijalankan pemilik)

Sebelum ada kode produksi, buktikan bahwa jalur L2TP/IPsec bisa hidup di container Docker bridge di radpro. Spike juga menetapkan daemon, nilai RouterOS, dan aturan nft yang dipakai Task 2–7.

**Files:**
- Create (scratchpad, tidak di-commit): `spike-l2tp/Dockerfile`, `spike-l2tp/run.sh`, `spike-l2tp/router.rsc`, `spike-l2tp/cleanup.sh`
- Modify: `netmanager/docs/superpowers/specs/2026-10-19-vpn-mikrotik-spike-results.md` (bagian baru "L2TP/IPsec 2026-10-xx", tanpa nilai rahasia)

- [ ] **Step 1: Tulis image spike.** Basis `alpine:3.22` dengan strongSwan, nftables, dan daemon PPP.
  - Coba `apk add accel-ppp`. Bila tidak ada di aports, pakai `xl2tpd ppp`.
  - Konfigurasi statis:
    - satu PSK;
    - satu user `nmvpn-spike` dengan IP `10.100.255.250`;
    - alamat lokal PPP `10.99.0.250`.
- [ ] **Step 2: Tulis `run.sh` untuk pemilik.**
  - Container bridge dengan `-p 500:500/udp -p 4500:4500/udp --device /dev/ppp --cap-add NET_ADMIN`.
  - Sebelumnya, di host: `modprobe l2tp_ppp l2tp_netlink ppp_generic esp4 xfrm_user af_key`. Sesudahnya: `docker logs`.
  - Tulis juga `cleanup.sh`, yang menghapus container. Modul kernel dibiarkan.
- [ ] **Step 3: Tulis `router.rsc` untuk router lab CHR 7.24.5** (`l2tp-client` ke `31.56.30.53`, `use-ipsec=yes`, `allow=mschap2`). Kredensial router lab tidak disimpan di mana pun.
- [ ] **Step 4: Pemilik menjalankan `run.sh` dan menempel `router.rsc`.** Catat hasil setiap butir:
  1. Daemon yang dipakai, perintah start masing-masing proses, dan cara memutus satu sesi berdasarkan alamat peer (`accel-cmd terminate ...` atau kill pid pppd).
  2. Tunnel naik lewat DNAT Docker (NAT-T di UDP 4500), dan `ip addr` di container menunjukkan `ppp0` dengan peer `10.100.255.250`.
  3. Proposal IKE/ESP yang disepakati dengan default `l2tp-client` RouterOS.
  4. MTU dengan DF dari router ke `10.99.0.250`, dan apakah nilai 1380 lolos.
  5. Aturan nft di container:
     - `iifname "ppp*" fib saddr . iif oif missing drop` menjatuhkan ping bersumber palsu dari router (`src-address` di luar `/32`);
     - `udp dport 1701 meta ipsec missing drop` tidak memutus L2TP yang di dalam IPsec.
  6. `/interface l2tp-client set netmanager-vpn connect-to=<host lain> ipsec-secret=<psk>` pada client yang tersambung memicu login ulang tanpa reboot. Bila hanya ada satu host, cukup buktikan login ulang ke host yang sama.
  7. Versi v7 tertua yang tersedia di lab. Bila hanya ada 7.24.5, itulah versi minimum sementara.
- [ ] **Step 5: Gerbang.**
  - Butir 2 gagal (L2TP/IPsec tidak hidup di bridge Docker radpro): berhenti dan tanya pemilik. Ini membatalkan "Hub PPP di radpro" di spec.
  - Butir lain gagal: catat sebagai ruling dengan nilai pengganti.
- [ ] **Step 6: Pemilik menjalankan `cleanup.sh`.** Lalu commit hasil spike ke repo netmanager (branch `docs/vpn-multi-protocol`):
```bash
git add docs/superpowers/specs/2026-10-19-vpn-mikrotik-spike-results.md
git commit -m "docs(vpn): hasil spike L2TP/IPsec di radpro"
```

### Task 2: RouterOS — script L2TP dan switch umum

**Files:**
- Create: `internal/routeros/l2tp.go`, `internal/routeros/testdata/full_l2tp.rsc`, `internal/routeros/testdata/scheduler_l2tp.rsc`, `internal/routeros/l2tp_test.go`
- Modify:
  - `internal/routeros/render.go`: `Input`, `Server`, `Validate`, `RenderFull` (dispatch), baris hapus client lain
  - `internal/routeros/switch.go`: placeholder protokol
  - `internal/routeros/testdata/full.rsc`: hanya baris hapus `l2tp-client` dan sisa `/32` PPP

**Interfaces:**
- Produces:
  - `const ProtocolWireGuard = "wireguard"`, `const ProtocolL2TP = "l2tp"`
  - `type Input struct { Label string; Address netip.Addr; Protocol string; PrivateKey string; PPPUser string; PPPPassword string; Servers []Server }`
  - `type Server struct { Host string; Port int; PublicKey string; IPsecSecret string }`
  - `RenderFull(in Input) string`, `RenderScheduler(in Input) string`, `SwitchSource(in Input) string`. Semuanya men-dispatch berdasarkan `in.Protocol`; string kosong berarti `wireguard`.
- Konstanta baru:
  - `l2tpPort = 500`. Ini hanya bagian kunci `host|port` di daftar server.
  - `pppMTU = 1380`, kecuali spike (R7) menetapkan lain.
  - `minVersion`, dari spike Task 1 butir 7.

- [ ] **Step 1: Tulis tes yang gagal** di `internal/routeros/l2tp_test.go`:
```go
func l2tpInput() Input {
	in := testInput()
	in.Protocol, in.PrivateKey = ProtocolL2TP, ""
	in.PPPUser, in.PPPPassword = "nmvpn-0a1b2c3d", "Zm9vYmFyYmF6cXV4cXV1eHF1dXhxdXV4"
	in.Servers[0].PublicKey, in.Servers[1].PublicKey = "", ""
	in.Servers[0].Port, in.Servers[1].Port = 500, 500
	in.Servers[0].IPsecSecret = "c2VjcmV0LW9uZS1zZWNyZXQtb25lLXNlY3JldC1vbmU"
	in.Servers[1].IPsecSecret = "c2VjcmV0LXR3by1zZWNyZXQtdHdvLXNlY3JldC10d28"
	return in
}
```
  Tes yang ditulis:
  - `TestRenderFullL2TPMatchesGolden` dan `TestRenderSchedulerL2TPMatchesGolden` (golden `full_l2tp.rsc` dan `scheduler_l2tp.rsc`).
  - `TestRenderL2TPRemovesWireGuardLast`: baris `/interface wireguard remove [find name=netmanager-vpn]` dan penghapusan `netmanager-lo` muncul **setelah** baris pembuat `l2tp-client` dan setelah scheduler (R1).
  - `TestRenderL2TPHasNoFetchOrImport`.
  - `TestRenderL2TPStopsBelowMinVersion`: baris pertama memuat `/system resource get version` dan `:error`.
  - `TestValidateRejectsSecretWithSeparator`: `IPsecSecret` berisi `|` ditolak, begitu juga `PPPUser` kosong.
  - `TestValidateL2TPDoesNotNeedPublicKey`.
  - `TestSwitchSourceL2TPSetsConnectToAndSecret`: memuat `/interface l2tp-client set $id connect-to=$host ipsec-secret=`, dan entri daftar berbentuk `"hub-a.example.net|500|<psk>"`.
  - `TestWireGuardSchedulerUnchanged`: `RenderScheduler(testInput())` sama dengan `scheduler.rsc` yang ada, tanpa mengubah golden itu.
- [ ] **Step 2: Jalankan tes, pastikan gagal.**
  Run: `go test ./internal/routeros/ -run 'L2TP|Separator|Unchanged' -v`
  Expected: FAIL (`ProtocolL2TP` belum ada).
- [ ] **Step 3: Implementasikan.**
  - `switchBody` mendapat placeholder `@FIND@`, `@CUR@`, dan `@SET@`. Nilai WireGuard-nya menghasilkan teks yang sekarang persis. Nilai L2TP:
    - `@FIND@` = `/interface l2tp-client find name=netmanager-vpn`
    - `@CUR@` = `connect-to . "|500|" . ipsec-secret`
    - `@SET@` = `set connect-to=$host ipsec-secret=<bagian ketiga>`
  - `renderL2TP` memakai `ensure`. Isinya:
    - `l2tp-client` dengan `connect-to` ke server pertama, kecuali client sudah memakai salah satu server di daftar (pola `writePeer`);
    - properti `user`, `password`, `use-ipsec=yes`, `ipsec-secret`, `allow=mschap2`, `max-mtu`, `max-mru`, `add-default-route=no`, dan `comment`;
    - routing table, rule, dan route seperti WireGuard, tanpa loopback;
    - scheduler;
    - terakhir, hapus interface WireGuard `netmanager-vpn` dan `netmanager-lo` beserta alamatnya.
  - `RenderFull` WireGuard mendapat baris `/interface l2tp-client remove [find name=netmanager-vpn]` di akhir. Golden `full.rsc` diperbarui hanya dengan baris itu.
  - Pengecekan versi ada hanya di script L2TP: `:if ([:pick [/system resource get version] 0 1] != "7" || <minor di bawah minVersion>) do={ :error "netmanager-vpn: butuh RouterOS minimal <minVersion>" }`.
- [ ] **Step 4: Jalankan semua tes paket, pastikan lulus.**
  Run: `go test ./internal/routeros/ -v`
  Expected: PASS, dan `git diff --stat internal/routeros/testdata/scheduler.rsc` kosong.
- [ ] **Step 5: Commit.**
```bash
git add internal/routeros
git commit -m "feat(routeros): script L2TP/IPsec dan switch per protokol"
```

### Task 3: Store — kolom protokol, kredensial PPP, PSK, kemampuan hub

**Files:**
- Modify:
  - `internal/store/store.go`: tambah migrasi di akhir `migrations`, jangan ubah entri lama
  - `internal/store/types.go`, `internal/store/core.go`, `internal/store/core_routers.go`, `internal/store/hub.go`
- Test: `internal/store/store_test.go`

**Interfaces:**
- Produces:
  - `Hub` + `IPsecPSK string` (tersegel, boleh kosong), `Protocols []string`
  - `Router` + `Protocol string`, `PPPUser string`, `PPPPassword string` (tersegel)
  - `HubConfig` + `IPsecPSK string` (tersegel)
  - `Peer` + `Protocol string`, `PPPUser string`, `PPPPassword string` (tersegel)
  - `(*Store) UpdateHubPSK(id, sealedPSK string) error`
  - `(*Store) UpdateHubProtocols(id string, protocols []string) error`
  - `(*Store) SetRouterProtocol(id, protocol, pppUser, sealedPPPPassword string) error`
  - `(*Store) SaveHubPSK(sealedPSK string) error`
- Migrasi, satu entri per pernyataan, sesuai gaya file:
  - `routers`: `protocol TEXT NOT NULL DEFAULT 'wireguard'`, `ppp_user TEXT NOT NULL DEFAULT ''`, `ppp_password TEXT NOT NULL DEFAULT ''`
  - `hubs`: `ipsec_psk TEXT NOT NULL DEFAULT ''`, `protocols TEXT NOT NULL DEFAULT 'wireguard'` (dipisah koma)
  - `hub_config`: `ipsec_psk TEXT NOT NULL DEFAULT ''`
  - `peers`: `protocol TEXT NOT NULL DEFAULT 'wireguard'`, `ppp_user TEXT NOT NULL DEFAULT ''`, `ppp_password TEXT NOT NULL DEFAULT ''`

- [ ] **Step 1: Tulis tes yang gagal.**
  - `TestRouterDefaultsToWireGuard`: router lama hasil migrasi bernilai `Protocol == "wireguard"`.
  - `TestSetRouterProtocolRoundTrip`.
  - `TestHubProtocolsRoundTrip`: `[]string{"wireguard","l2tp"}` kembali sama.
  - `TestUpsertPeerKeepsPPPFields`.
  - `TestMigrationFromPreviousSchema`: buka DB berisi skema sebelum migrasi baru, lalu semua baris lama terbaca.
- [ ] **Step 2: Jalankan tes.** Run: `go test ./internal/store/ -v`. Expected: FAIL.
- [ ] **Step 3: Implementasikan kolom, scan, dan setter.** `UpsertPeer` menulis kolom PPP, juga saat konflik.
- [ ] **Step 4: Jalankan tes.** Run: `go test ./internal/store/ -race -v`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): protokol router, kredensial PPP, PSK dan kemampuan hub`.

### Task 4: Hub — daemon PPP/IPsec, sesi, peer per protokol

**Files:**
- Create:
  - `internal/ppp/config.go`: `RenderSecrets`, `RenderIPsec`, `RenderDaemon`, dengan format dari spike
  - `internal/ppp/config_test.go`
  - `internal/ppp/supervisor.go`: menjalankan dan menjaga proses anak, termasuk reload
  - `internal/ppp/sessions.go`: interface
  - `internal/ppp/sessions_linux.go`: netlink
  - `internal/ppp/sessions_memory.go`: fake untuk tes
  - `internal/ppp/sessions_other.go`
- Modify:
  - `internal/hub/hub.go`:
    - `nmConfig` melewati peer non-WireGuard;
    - `reconcile` menulis konfigurasi PPP;
    - `PeerStatuses` memberi stempel untuk sesi PPP;
    - `UpsertPeer` dan `DeletePeer` memutus sesi
  - `internal/hub/api.go`: body peer, `PUT /v1/ipsec`, `GET /v1/info`
  - `cmd/netmanager-vpn/run_hub.go`: memasang supervisor dan sesi
- Test: `internal/hub/hub_test.go`, `internal/hub/api_test.go`

**Interfaces:**
- Produces, untuk Task 6 (kontrak JSON):
  - `PUT /v1/peers/{pub}` body `{"address":"10.100.0.10","protocol":"l2tp","pppUsername":"nmvpn-…","pppPassword":"…"}`. Bila `protocol` tidak ada, nilainya `wireguard`, dan field PPP harus kosong. Untuk `l2tp`, `pppUsername` harus cocok `^nmvpn-[0-9a-f]{1,64}$` dan `pppPassword` harus cocok `^[A-Za-z0-9_-]{24,64}$`; selain itu 400.
  - `PUT /v1/ipsec` body `{"psk":"…"}`. PSK harus cocok `^[A-Za-z0-9_-]{32,128}$`. Respons 204; bila PSK sama dengan yang tersimpan, tidak ada reload.
  - `GET /v1/info` → `{"protocols":["wireguard","l2tp"]}`. `l2tp` ikut hanya bila semua syarat ini terpenuhi:
    - `/dev/ppp` ada;
    - `/sys/module/l2tp_ppp` ada;
    - PSK tersimpan;
    - supervisor melaporkan kedua proses hidup.
  - `type Sessions interface { Live() (map[netip.Addr]bool, error); Terminate(addr netip.Addr) error }` di `internal/ppp`.
  - `ppp.NewSupervisor(dir string) *Supervisor`, `(*Supervisor) Apply(secrets, ipsec, daemon string) error`, `(*Supervisor) Running() bool`.
  - `hub.Options` + `Sessions ppp.Sessions`, `PPP PPPRuntime` (nil berarti hub WireGuard saja, dipakai di tes dan di host tanpa `/dev/ppp`).
- Alamat lokal PPP di hub adalah `cfg.BackhaulAddr`. Alamat peer adalah `/32` router dari `chap-secrets`.

- [ ] **Step 1: Tulis tes yang gagal.**
  - `TestRenderSecretsOneLinePerL2TPPeer`: format `"<user>" * "<password>" <addr>`. Peer WireGuard tidak masuk. Karakter `"` di password tidak mungkin ada karena validasi, tetapi tes tetap memastikan baris tidak bisa disisipi.
  - `TestNMConfigSkipsL2TPPeers`: allowed-IP `wg-nm` hanya untuk peer WireGuard.
  - `TestUpsertPeerProtocolChangeTerminatesSession`:
    - peer `l2tp` dengan sesi hidup di fake, lalu di-upsert sebagai `wireguard`;
    - `Terminate(addr)` terpanggil;
    - `wg-nm` kini memuat `/32` itu;
    - `chap-secrets` tidak lagi memuat user itu.
  - `TestDeletePeerTerminatesSession`.
  - `TestPeerStatusesStampsLivePPPSession`:
    - sesi hidup memberi `LastHandshakeAt == now`;
    - tanpa sesi nilainya `nil`;
    - peer WireGuard tetap dari kernel WG.
  - `TestPutPeerWithoutProtocolIsWireGuard`: body lama tetap 204.
  - `TestPutPeerRejectsBadPPPFields`.
  - `TestInfoReportsL2TPOnlyWhenReady`: tabel atas `/dev/ppp`, modul, PSK, dan proses hidup.
  - `TestPutIPsecSamePSKNoReload`.
- [ ] **Step 2: Jalankan tes.** Run: `go test ./internal/ppp/ ./internal/hub/ -v`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.**
  - Supervisor:
    - menulis file konfigurasi ke `dir` dengan mode `0600`;
    - menyalakan proses dengan perintah dari spike;
    - menyalakan ulang proses yang mati, dengan jeda 5 s;
    - me-reload IPsec hanya bila PSK berubah (`swanctl --load-all` atau padanannya dari spike).
  - `chap-secrets` cukup ditulis ulang, karena daemon membacanya ulang setiap login.
  - `Sessions` di Linux: daftar link bertipe ppp yang UP dengan alamat peer, lewat `vishvananda/netlink` (sudah jadi dependensi). `Terminate` memakai cara dari spike.
  - Body peer dan log tidak pernah memuat password.
- [ ] **Step 4: Jalankan tes.** Run: `go test ./internal/ppp/ ./internal/hub/ -race -v && GOOS=linux go build ./...`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(hub): layani L2TP/IPsec lewat daemon anak; peer per protokol`.

### Task 5: Firewall hub untuk `ppp*`

**Files:**
- Modify: `internal/firewall/render.go`, `internal/firewall/testdata/hub.nft`, `internal/firewall/dockeruser.go`
- Test: `internal/firewall/render_test.go`, `internal/firewall/dockeruser_test.go`

**Interfaces:**
- Produces: `RenderHub()` (tanpa argumen, seperti sekarang) dan `HubDockerAccepts` dengan dua aturan tambahan `-i ppp+ -o wg-up` dan `-i wg-up -o ppp+`.
- Aturan baru, ditulis eksplisit per interface (tanpa set wildcard):
  - forward:
    - baris pertama `iifname "ppp*" fib saddr . iif oif missing drop`;
    - setiap aturan `wg-nm` yang ada diulang dengan `iifname "ppp*"` / `oifname "ppp*"` dalam urutan yang sama.
  - input:
    - `udp dport 1701 meta ipsec missing drop`;
    - `iifname "ppp*" fib saddr . iif oif missing drop`;
    - `iifname "ppp*" icmp type echo-request accept`;
    - `iifname "ppp*" drop`.
  - Bila spike memberi sintaks lain untuk `meta ipsec` atau `fib`, sintaks spike yang dipakai (ruling).

- [ ] **Step 1: Perbarui golden `hub.nft`** dengan aturan di atas, lalu tambah tes `TestHubRulesetTreatsPPPLikeWGNM`. Tes ini memastikan setiap aturan berawalan `iifname "wg-nm"` punya kembaran `iifname "ppp*"`, dan baris drop 1701 ada di chain input.
- [ ] **Step 2: Jalankan.** Run: `go test ./internal/firewall/ -v`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.**
- [ ] **Step 4: Jalankan.** Expected: PASS. Bila ada mesin Linux dengan `nft`, tambah `nft -c -f internal/firewall/testdata/hub.nft`.
- [ ] **Step 5: Commit** `feat(firewall): aturan hub berlaku untuk sesi PPP; L2TP hanya di dalam IPsec`.

### Task 6: Core — protokol router, PSK hub, kemampuan, endpoint baru

**Files:**
- Create: `internal/core/protocol.go` (`SetRouterProtocol`, `ProtocolScript`, `FirstServer`, pembuat kredensial PPP dan PSK), `internal/core/protocol_test.go`
- Modify:
  - `internal/core/hubclient.go`: `UpsertPeer` menerima `PeerSpec`; tambah `SetIPsecPSK` dan `Info`
  - `internal/core/routers.go`: `CreateRouter(ctx, label, hubIDs, protocol)` dan `validateHubIDs(ids, protocol)`
  - `internal/core/routers_sync.go`: `register` mengirim `PeerSpec`; `SyncPending` memastikan PSK dan membaca info
  - `internal/core/script.go`: `routerInput` mengisi protokol, kredensial, dan PSK
  - `internal/core/hubs.go`: `CreateHub` membuat PSK; `HubView.Protocols`
  - `internal/core/routers_view.go`: `RouterView.Protocol`
  - `internal/core/api.go`, `internal/core/api_routers.go`: rute baru
- Test: `internal/core/routers_test.go`, `internal/core/hubs_test.go`, `internal/core/hubclient_test.go` (kontrak JSON), `internal/core/api_test.go`. Fake `recHubs` disesuaikan.

**Interfaces:**
- Consumes:
  - dari Task 2: `routeros.Input`, `routeros.Server`, `routeros.ProtocolL2TP`;
  - dari Task 3: setter store;
  - dari Task 4: kontrak JSON hub.
- Produces, untuk Task 8 (kontrak JSON):
  - `POST /v1/routers` body `{"label","hubIds","protocol"?}`. Bila `protocol` tidak ada, nilainya `wireguard`; protokol lain ditolak dengan `400 validation`.
  - `RouterView` + `"protocol":"wireguard"|"l2tp"`. `HubView` + `"protocols":["wireguard",…]`.
  - `POST /v1/routers/{id}/protocol-script` body `{"protocol"}` → teks script full untuk protokol itu.
    - Membuat kredensial PPP bila belum ada, tetapi **tidak** mengubah protokol router maupun hub (R1).
    - Hub di daftar router yang tidak mendukung protokol itu → `400 validation`.
  - `POST /v1/routers/{id}/protocol` body `{"protocol"}` → `RouterView`.
    - Menyetel protokol dan menandai semua link `pending`, lalu `pushPeer` ke tiap hub.
    - Protokol yang sama → no-op, 200.
  - `GET /v1/routers/{id}/first-server` → `{"protocol","host","port","publicKey"?,"ipsecSecret"?}` untuk hub prioritas terendah.
  - `type PeerSpec struct { PublicKey string; Address netip.Addr; Protocol, PPPUser, PPPPassword string }`
  - `HubClient`:
    - `UpsertPeer(ctx, hub, PeerSpec) error`
    - `DeletePeer(ctx, hub, pub) error`
    - `Peers(ctx, hub) ([]HubPeerStatus, error)`
    - `SetIPsecPSK(ctx, hub, psk string) error`
    - `Info(ctx, hub) (HubInfo, error)`, dengan `type HubInfo struct { Protocols []string }`. Status 404 diterjemahkan menjadi `HubInfo{Protocols: []string{"wireguard"}}`.

- [ ] **Step 1: Tulis tes yang gagal.**
  - `TestCreateRouterL2TPMakesPPPCredentials`:
    - user `nmvpn-<id>`;
    - password 32 karakter base64url;
    - `PeerSpec` ke hub memuat keduanya.
  - `TestCreateRouterDefaultsToWireGuard`.
  - `TestValidateHubIDsRejectsHubWithoutProtocol`: hub dengan `Protocols=["wireguard"]` menolak router `l2tp`.
  - `TestProtocolScriptDoesNotSwitch`: setelah `protocol-script`, `GetRouter().Protocol` masih `wireguard` dan tidak ada upsert ke hub.
  - `TestSetRouterProtocolPushesToEveryHub`.
  - `TestPPPCredentialsKeptAcrossProtocolChanges`: ganti `l2tp` → `wireguard` → `l2tp`, user dan password tetap sama.
  - `TestCreateHubGeneratesPSK`.
  - `TestSyncEnsuresPSKForOldHub`: hub tanpa PSK mendapat PSK, lalu `SetIPsecPSK` dipanggil.
  - `TestSyncStoresHubProtocols`.
  - `TestSyncToleratesHubWithoutInfo`: `Info` dan `SetIPsecPSK` membalas 404, pass tetap tanpa error, dan protokol tetap `["wireguard"]`.
  - `TestFirstServerL2TPIncludesSecret`.
  - `TestRouterScriptL2TPRendersPSKPerHub`.
  - Di `hubclient_test.go`, `TestHubClientPeerBodyMatchesHub`: body JSON yang dikirim core sama persis dengan yang diterima `hub.putPeerRequest`. Perluas tes kontrak yang ada.
- [ ] **Step 2: Jalankan.** Run: `go test ./internal/core/ -v`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.** Rinciannya:
  - Kredensial memakai `crypto/rand` dan `base64.RawURLEncoding`, lalu disegel dengan `c.box` sebelum disimpan.
  - Rute ditambahkan ke `Handler` sesuai urutan yang ada.
  - Hub tanpa PSK atau tanpa `l2tp` di `Protocols` tidak pernah dipakai untuk router L2TP.
  - Hub lama dengan `Protocols` kosong dianggap `["wireguard"]`.
- [ ] **Step 4: Jalankan.** Run: `go test ./... -race && go vet ./... && test -z "$(gofmt -s -l .)"`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): protokol per router, PSK per hub, ganti protokol dua langkah`.

### Task 7: Image dan perintah instal hub

**Files:**
- Modify:
  - `Dockerfile`: paket strongSwan dan daemon PPP dari spike
  - `deploy/install-hub.sh`
  - `deploy/install-hub_test.sh`
  - `internal/core/hub_commands.go`: perintah membawa `NMVPN_PORTS`
- Test: `internal/core/hubs_test.go` (isi perintah) dan `deploy/install-hub_test.sh`

**Interfaces:**
- Consumes: `Hub.ListenPort`.
- Produces: perintah `curl -fsSL <url> | $(command -v sudo) env NMVPN_IMAGE=<img> NMVPN_PORTS="<listenPort>/udp 500/udp 4500/udp" sh -s -- <bundle|upgrade>`.

- [ ] **Step 1: Tulis tes yang gagal.**
  - `TestHubCommandCarriesPorts` (Go).
  - Di `install-hub_test.sh`, kasus berikut, memakai `ss`, `iptables-save`, dan `modprobe` palsu di `PATH`:
    1. Port yang sudah dipakai socket lain ditolak dengan pesan berisi `Port 500/udp sudah dipakai`.
    2. Port yang punya aturan DNAT ditolak.
    3. `modprobe l2tp_ppp` yang gagal tidak menggagalkan instal, tetapi mencetak `L2TP tidak tersedia di VPS ini`.
    4. `NMVPN_PORTS` kosong ditolak.
- [ ] **Step 2: Jalankan.** Run: `sh deploy/install-hub_test.sh && go test ./internal/core/ -run HubCommand`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `install-hub.sh`.**
  - `check_host` memuat modul PPP dan IPsec. Kegagalan di sini non-fatal; WireGuard tetap fatal.
  - Fungsi `check_ports` jalan setelah `docker rm -f` container sendiri dan sebelum `docker run`. Ia menolak port yang dipakai socket (`ss -Hlnu`/`-Hlnt`) atau muncul di `iptables-save -t nat` sebagai `--dport`.
  - `open_firewall` berjalan bila `ufw status` aktif (`ufw allow <port>`) atau `firewall-cmd --state` running (`--add-port --permanent` lalu `--reload`).
  - `start_hub` menambah `--device /dev/ppp` bila `/dev/ppp` ada. `upgrade` mewarisinya karena memanggil `start_hub`.
- [ ] **Step 4: Jalankan.** Run: `sh deploy/install-hub_test.sh && sh -n deploy/install-hub.sh && go test ./... && docker build -t nmvpn-l2tp-test .`. Expected: PASS, image ter-build.
- [ ] **Step 5: Commit** `feat(deploy): instal hub memuat modul L2TP, cek bentrok port, buka firewall VPS`.

---

## Bagian B — netmanager

### Task 8: Data dan klien core

**Files:**
- Create: `prisma/migrations/20261024090000_add_vpn_protocol/migration.sql` (komentar SQL berbahasa Indonesia)
- Modify:
  - `prisma/schema.prisma`:
    - `enum VpnProtocol { WIREGUARD L2TP }`
    - `MikroTikRouter.vpnProtocol VpnProtocol @default(WIREGUARD)`
    - `VpnServer.protocols String[] @default(["wireguard"])`
  - `modules/network/vpn/types.ts`:
    - `CoreHub.protocols: string[]`
    - `CoreRouter.protocol: CoreVpnProtocol`
    - `type CoreVpnProtocol = "wireguard" | "l2tp"`
    - `CoreFirstServer`
  - `modules/network/vpn/VpnCoreClient.ts`:
    - `createRouter({label, hubIds, protocol})`
    - `protocolScript(id, protocol): Promise<string>`
    - `setRouterProtocol(id, protocol): Promise<CoreRouter>`
    - `firstServer(id): Promise<CoreFirstServer>`
  - `modules/network/vpn/index.ts`: export baru
  - `modules/network/repositories/VpnServerRepository.ts`: `hubFields` menyalin `protocols`; `tenantServers` memilih `protocols`
  - `modules/network/domain/ports/IVpnServerRepository.ts`: `VpnServerSummary.protocols: string[]`
  - `modules/network/domain/entities/MikroTikRouterEntity.ts`: `vpnProtocol` di create, update, dan entity
- Create: `modules/network/vpn/protocol.ts`, berisi `toCoreProtocol(p: VpnProtocol): CoreVpnProtocol` dan `fromCoreProtocol(p: CoreVpnProtocol): VpnProtocol`
- Test:
  - `tests/modules/network/vpn/VpnCoreClient.test.ts`
  - `tests/modules/network/VpnServerService.test.ts`
  - `tests/modules/network/vpn/protocol.test.ts` (baru)

- [ ] **Step 1: Tulis tes yang gagal.**
  - `createRouter mengirim protocol` (body `{label, hubIds, protocol:"l2tp"}`).
  - `protocolScript POST ke /v1/routers/:id/protocol-script dan membaca teks`.
  - `setRouterProtocol POST ke /v1/routers/:id/protocol`.
  - `firstServer GET /v1/routers/:id/first-server`.
  - `hubFields menyalin protocols` dan `hub tanpa protocols disimpan sebagai ["wireguard"]` (core lama).
  - `toCoreProtocol/fromCoreProtocol bolak-balik`.
- [ ] **Step 2: Jalankan.** Run: `npx vitest run tests/modules/network/vpn tests/modules/network/VpnServerService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.** Lalu `npx prisma migrate dev --name add_vpn_protocol --create-only`, rapikan nama folder menjadi `20261024090000_add_vpn_protocol`, dan `npx prisma generate`.
- [ ] **Step 4: Jalankan.** Run: `npx vitest run tests/modules/network tests/architecture && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(vpn): kolom protokol router dan server, klien core per protokol`.

### Task 9: Draft dan simpan router membawa protokol

**Files:**
- Modify:
  - `lib/validations/vpn.ts`:
    - `vpnProtocolSchema = z.enum(["WIREGUARD","L2TP"])`
    - `vpnDraftCreateSchema.protocol` (default `WIREGUARD`)
    - `routerVpnEnableSchema.protocol` (R6)
    - schema baru `routerVpnProtocolSchema {protocol}`
  - `lib/validations/mikrotik.ts`: base create mendapat `vpnProtocol: vpnProtocolSchema.optional()`
  - `modules/network/services/VpnDraftService.ts`:
    - `VpnDraftInput.protocol`
    - `prepareDraft` mengirim `toCoreProtocol`
    - `reusePrevious` mensyaratkan protokol sama
    - `createExtendDraft` menerima protocol
  - `modules/network/services/vpn-server-availability.ts`: `assertServersOnline` menjadi `assertServersUsable(repo, tenantId, serverIds, protocol)`, yang juga mensyaratkan `protocols` memuat protokol itu. Caller lama diperbarui.
  - `modules/network/services/mikrotik-router.vpn-create.ts`:
    - `VpnRouterRequest.vpnProtocol`
    - `assertDraftUsable` mensyaratkan `draft.protocol === toCoreProtocol(vpnProtocol)`
    - `create` menyimpan `vpnProtocol`
  - `modules/network/services/mikrotik-router.mutations.ts`: destrukturisasi `vpnProtocol` bersama `vpnDraftId`, `vpnServerIds` (file 342 baris; bila melewati 350, pindahkan destrukturisasi VPN ke `mikrotik-router.vpn-create.ts`)
  - `modules/network/services/VpnRouterMigrationService.ts` (`enable` meneruskan protokol)
  - Rute `app/api/mikrotik-routers/vpn-draft/route.ts` dan `app/api/mikrotik-routers/[id]/vpn/enable/route.ts`: hanya meneruskan field yang sudah divalidasi
- Test:
  - `tests/lib/validations/vpn.test.ts`
  - `tests/modules/network/VpnDraftService.test.ts`
  - `tests/modules/network/mikrotik-router-vpn-create.test.ts`
  - `tests/modules/network/VpnRouterService.migrate.test.ts`
  - `tests/api/mikrotik-routers-vpn-draft-route.test.ts`

- [ ] **Step 1: Tulis tes yang gagal.**
  - `createDraft L2TP mengirim protocol l2tp ke core`.
  - `reusePrevious menghapus draft bila protokol berbeda`.
  - `createDraft menolak server yang tidak mendukung L2TP` (`VpnServerNotAvailableError`).
  - `createVpnRouter menolak draft yang protokolnya beda dari request`.
  - `createVpnRouter menyimpan vpnProtocol L2TP`.
  - `vpnDraftCreateSchema default WIREGUARD dan menolak "PPTP"`.
  - `enable meneruskan protokol`.
- [ ] **Step 2: Jalankan.** Run: `npx vitest run tests/modules/network tests/lib/validations tests/api`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.**
- [ ] **Step 4: Jalankan.** Run: `npm test && npx tsc --noEmit && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(vpn): draft dan simpan router membawa protokol`.

### Task 10: Form — pilihan protokol dan panduan port

**Files:**
- Create: `app/admin/network/mikrotik/components/VpnProtocolPicker.tsx`, berisi `VpnProtocolPicker({value, onChange}: {value: VpnProtocol; onChange(p: VpnProtocol): void})`. Bentuknya radio WireGuard / L2TP/IPsec, dengan satu baris penjelasan per pilihan:
  - WireGuard: "paling ringan, butuh UDP keluar"
  - L2TP/IPsec: "dikenal teknisi, untuk jaringan yang memblokir WireGuard"
- Modify:
  - `app/admin/network/mikrotik/components/VpnConnectionSection.tsx`:
    - prop `protocol` dan `onProtocolChange`;
    - picker tampil di atas daftar server;
    - daftar server difilter ke `protocols` yang memuat protokol terpilih;
    - pesan kosong: "Belum ada server yang mendukung L2TP untuk tenant ini".
  - `app/admin/network/mikrotik/mikrotikFormShared.ts`: `VpnServerOption.protocols`, `MikrotikVpnFormFields.vpnProtocol`. File sudah 304 baris; bila perlu, tipe VPN dipindah ke `mikrotikVpnFormShared.ts`.
  - `app/admin/network/mikrotik/hooks/useVpnRouterMode.ts`: `handleProtocolChange` membuang server terpilih yang tidak mendukung protokol baru dan menandai draft usang; `draftRequest.protocol`.
  - `components/mikrotik/VpnScriptModal.tsx`: `VpnDraftRequest.protocol`.
  - `app/admin/network/mikrotik/new/MikrotikNewClient.tsx`: `formData` awal `vpnProtocol: "WIREGUARD"`.
  - `app/admin/network/mikrotik/[id]/edit/RouterVpnEnablePanel.tsx`: picker yang sama, dikirim di request enable (R6).
  - `app/admin/tenants/vpn/VpnServerInstallGuide.tsx`:
    - daftar port menambah "UDP 500 dan 4500 untuk L2TP/IPsec";
    - perintah cek menambah `; modprobe l2tp_ppp && echo "l2tp OK"`;
    - teks hasil benar menyebut `l2tp OK` sebagai opsional.
- Test: `tests/app/mikrotik-new-vpn.test.tsx`, `tests/app/mikrotik-router-vpn-migration.test.tsx`, `tests/app/admin-vpn-server-panel.test.tsx`

- [ ] **Step 1: Tulis tes yang gagal.**
  - `memilih L2TP menyembunyikan server tanpa l2tp`.
  - `memilih L2TP mengirim protocol L2TP saat membuat draft`.
  - `ganti protokol setelah draft dibuat menandai draft usang`.
  - `default WireGuard tidak mengubah request lama` (snapshot body draft sama dengan sekarang ditambah `protocol:"WIREGUARD"`).
  - `panel aktifkan VPN mengirim protokol`.
  - `panduan server menyebut UDP 500 dan 4500`.
- [ ] **Step 2: Jalankan.** Run: `npx vitest run tests/app`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.**
- [ ] **Step 4: Jalankan.** Run: `npm test && npm run lint && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(vpn): pilihan protokol di form router dan panduan port L2TP`.

### Task 11: Ganti protokol, label daftar, dan kembali ke server pertama

**Files:**
- Create:
  - `modules/network/services/VpnRouterProtocolService.ts`, dengan:
    - `class VpnRouterProtocolService(repo: IMikroTikRouterVpnRepository, servers: Pick<IVpnServerRepository,"tenantServers">)`
    - `previewScript(routerId, tenantId, protocol): Promise<string>`
    - `apply(routerId, tenantId, protocol): Promise<void>`
  - `modules/network/factories/VpnRouterProtocolServiceFactory.ts`
  - `app/api/mikrotik-routers/[id]/vpn/protocol-script/route.ts` (POST, perm `mikrotik:update`, `routerVpnProtocolSchema`, teks script dalam `apiSuccess({script})`)
  - `app/api/mikrotik-routers/[id]/vpn/protocol/route.ts` (POST, perm `mikrotik:update`)
  - `app/admin/network/mikrotik/[id]/edit/RouterVpnProtocolPanel.tsx`
  - `app/admin/network/mikrotik/components/VpnProtocolBadge.tsx`
- Modify:
  - `modules/network/services/mikrotik-vpn-routeros.ts`: `writePeerEndpoint` diganti `writeFirstServer(router, server: CoreFirstServer)`, yang men-dispatch per protokol:
    - WireGuard: `/interface/wireguard/peers/set` seperti sekarang;
    - L2TP: `/interface/l2tp-client/set` dengan `connect-to` dan `ipsec-secret`.
  - `modules/network/services/VpnRouterService.ts`: `firstServerEndpoint` memakai `core.firstServer`.
  - Repo dan port router VPN: `setVpnProtocol(routerId, tenantId, protocol)`; `VpnRouterRecord.vpnProtocol`.
  - `app/admin/network/mikrotik/[id]/edit/MikrotikEditClient.tsx`: render `RouterVpnProtocolPanel` di bawah `RouterVpnPanel`.
  - `app/admin/network/mikrotik/hooks/useMikrotikRouterList.ts`: `MikrotikRouterListItem.vpnProtocol: "WIREGUARD"|"L2TP"|null` (null untuk PUBLIC).
  - `modules/network/repositories/MikroTikRouterRepository.ts`: isi field itu.
  - `app/admin/network/mikrotik/components/mikrotikRouterTable.tsx`: `<VpnProtocolBadge>` di samping badge "Server cadangan".
  - `modules/network/index.ts`: export factory (tes `module-public-api`).
- Test:
  - `tests/modules/network/VpnRouterProtocolService.test.ts` (baru)
  - `tests/api/mikrotik-routers-id-vpn-protocol-route.test.ts` (baru)
  - `tests/app/mikrotik-router-vpn-panel.test.tsx`
  - `tests/modules/network/mikrotik-vpn-routeros.test.ts`
  - `tests/modules/network/VpnRouterService.test.ts`

**Alur panel (R1):**
1. Pilih protokol. Protokol saat ini disabled.
2. "Buat script". Panel menampilkan script lewat kotak salin yang sama dengan `VpnScriptModal`, plus satu catatan: "Tempel di router, lalu tekan Terapkan. Tunnel lama putus di akhir script; router offline sampai Terapkan ditekan."
3. "Terapkan" memanggil `protocol`, lalu polling status yang sudah ada (`GET /api/mikrotik-routers/[id]/vpn`, `lastHandshakeAt` baru) sampai "Tunnel tersambung".

- [ ] **Step 1: Tulis tes yang gagal.**
  - `previewScript tidak mengubah vpnProtocol`.
  - `previewScript menolak server router yang tidak mendukung protokol`.
  - `apply memanggil core.setRouterProtocol lalu menyimpan vpnProtocol`.
  - `apply gagal di core tidak mengubah DB`.
  - `rute protocol-script butuh mikrotik:update dan router milik tenant`.
  - `writeFirstServer L2TP men-set connect-to dan ipsec-secret`.
  - `returnToFirstServer memakai core.firstServer`.
  - `panel ganti protokol: Terapkan baru aktif setelah script dibuat`.
  - `badge L2TP tampil untuk router VPN L2TP, tidak untuk PUBLIC`.
- [ ] **Step 2: Jalankan.** Run: `npx vitest run tests/modules/network tests/api tests/app`. Expected: FAIL.
- [ ] **Step 3: Implementasikan.**
- [ ] **Step 4: Jalankan.** Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(vpn): ganti protokol router, label protokol, kembali ke server pertama per protokol`.

### Task 12: Dokumen operasional dan changelog

**Files:**
- Modify:
  - `docs/deployment/netmanager-vpn.md`, bagian "Hub L2TP di radpro":
    - modul host yang dimuat dan cara membuatnya bertahan reboot (`/etc/modules-load.d/netmanager-vpn-ppp.conf`);
    - perintah container bridge (`-p 500:500/udp -p 4500:4500/udp -p <wg port>:<wg port>/udp --device /dev/ppp --cap-add NET_ADMIN --sysctl net.ipv4.ip_forward=1`, state dir sendiri);
    - urutan upgrade;
    - cara mencabut;
    - aturan "tetapkan hanya ke tenant uji sampai lab lulus" (R5).
  - `docs/CHANGELOG.md`
- [ ] **Step 1: Tulis bagian dokumen** tanpa nilai rahasia, dengan IP radpro seperti dokumen yang ada.
- [ ] **Step 2: Commit** `docs(vpn): hub L2TP di radpro dan changelog`.

---

## Bagian C — Rilis dan uji lab (bersama pemilik)

### Task 13: Rilis, pasang hub L2TP di radpro, uji lab

Semua perintah di radpro dan push ke `main` dijalankan pemilik, atau dijalankan atas izin eksplisitnya.

- [ ] **Step 1: netmanager-vpn.** PR `feat/l2tp` → CI hijau → merge atas izin pemilik → catat tag image dari workflow `build-image`.
- [ ] **Step 2: Siapkan skrip pemilik** di scratchpad. Skrip:
  1. rollout core ke image baru;
  2. mengecek `GET /v1/hubs`, yang harus menunjukkan hub A/B dengan `protocols:["wireguard"]` dan router WireGuard lab tetap online.
- [ ] **Step 3: netmanager.** PR `feat/vpn-l2tp` → tes hijau → merge dan push atas izin pemilik (deploy). Lalu cek:
  - migrasi terpasang;
  - rute baru menjawab 401;
  - form lama tetap jalan.
- [ ] **Step 4: Pasang hub L2TP.**
  - Pemilik membuat server baru lewat "Tambah Server VPN" (publicHost `31.56.30.53`, port WireGuard yang belum dipakai, misalnya 51824).
  - Pemilik menjalankan skrip bridge dari Task 12 dengan bundle-nya.
  - Server ditetapkan hanya ke tenant uji.
  - Tunggu sampai `protocols` memuat `l2tp`.
- [ ] **Step 5: Uji per "Ukuran keberhasilan" 1–3 dan lab poin 1–3, 5–9 di spec.** Butir 4 (pindah hub) menunggu VPS kedua.
  - Router lab CHR dibuat lewat form dengan L2TP.
  - Satu router di belakang NAT (NAS pemilik tanpa IP publik). Bila belum ada, catat sebagai sisa dan jangan tetapkan server L2TP ke tenant produksi.
  - Ganti protokol WireGuard ↔ L2TP lewat panel.
  - RADIUS/PPPoE lewat tunnel: `nasname` dan sumber di log FreeRADIUS harus `/32` router.
  - Router WireGuard lab tetap tersambung selama hub L2TP dipasang, di-restart, dan dicabut.
- [ ] **Step 6: Tulis hasil** ke `docs/superpowers/specs/2026-10-19-vpn-mikrotik-spike-results.md` dan commit lewat PR docs. Perbarui memori `netmanager-vpn-repo`.
- [ ] **Step 7: Bersihkan scratchpad** (skrip lab, rsc berkunci).
