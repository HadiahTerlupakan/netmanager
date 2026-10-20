# netmanager-vpn Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu binary Go `netmanager-vpn` dengan mode `core` (radpro) dan `hub`
(tiap VPS). Binary ini mengelola WireGuard, nftables, alokasi IP, daftar server per
router, pemilihan hub aktif, dan script RouterOS, lalu menyediakan API kontrol yang
dipakai netmanager (rencana 3).

**Architecture:** Netmanager **hanya bicara dengan core**. Core menyimpan registry
hub, router, dan peer admin, lalu memanggil API hub lewat backhaul (`10.99.0.N:7480`)
untuk mendaftarkan peer router. Ini menerapkan "netmanager memanggil hub lewat core"
di spec dengan cara proxy-by-operation, bukan reverse proxy mentah, sehingga
netmanager tidak perlu memegang token tiap hub. Keputusan berada di fungsi murni yang
dites. Kernel, nft, dan HTTP berada di balik interface kecil.

**Tech Stack:** Go 1.26.x, `golang.zx2c4.com/wireguard/wgctrl`,
`github.com/vishvananda/netlink`, `modernc.org/sqlite` (pure Go, tanpa cgo), stdlib
`net/http` dan `log/slog`. `nft` dipanggil sebagai proses (`nft -f -`).

**Spec:** `docs/superpowers/specs/2026-10-19-vpn-mikrotik-design.md`. **Prasyarat:**
rencana spike `docs/superpowers/plans/2026-10-19-vpn-spike.md` selesai. Golden file
`vpn-hub.nft`, `vpn-router-base.rsc`, `vpn-router-switch.rsc`, dan file hasil spike
dipakai di sini. Kalau hasil spike mengubah MTU atau versi minimum, nilai di Global
Constraints mengikuti file hasil spike.

## Global Constraints

- Repo baru `netmanager-vpn`, di luar repo netmanager. **Pembuatan repo GitHub
  (private) dan visibilitas image GHCR ditanyakan ke pemilik di Task 1**, karena
  keduanya tindakan keluar.
- Backhaul `10.99.0.0/24`: core `10.99.0.1`, hub `.2`–`.126`. Admin `10.99.128.0/24`.
  Router `/32` dari `10.100.0.0/14`.
- Interface: core `wg-core` (UDP 51822, MTU 1380). Hub: `wg-nm` (UDP 51821, MTU 1420)
  dan `wg-up` (MTU 1380). Port 51820 milik tikman dan tidak boleh dipakai.
- API kontrol di port 7480, bearer token. Core hanya menerima dari `10.42.0.0/16`
  dan loopback. Hub hanya mendengar di alamat backhaul-nya dan menerima dari
  `10.99.0.1`.
- Hub me-route, tidak me-NAT. Forward nftables stateless (golden `vpn-hub.nft`).
- Peer router `pending` yang lebih dari 24 jam tidak di-claim dihapus otomatis.
  Join hub yang lebih dari 1 jam tanpa handshake dianggap kedaluwarsa.
- Hub aktif = hub dengan handshake router paling baru dan < 180 s. Pengendali
  berjalan setiap 10 s.
- Private key di SQLite dienkripsi AES-256-GCM. Kuncinya dari env
  `NMVPN_ENCRYPTION_KEY` (32 byte, base64).
- State di `/var/lib/netmanager-vpn/state.db`.
- Script RouterOS tidak memuat `/tool fetch` atau `/import`, dan aman ditempel ulang.
- Komentar di kode menjelaskan alasan, bukan menjelaskan apa yang dikerjakan. Pola
  pemisahan device-nya mengikuti `tikman/backend/internal/connectivity/wireguard_device*.go`.

## Review Focus

- Hub yang belum pernah tersambung (`pending_install`) muncul di daftar server
  router: router tidak bisa memakai server yang tidak online. `CreateRouter` dan
  `SetRouterHubs` menolaknya (Task 8).
- Dua hub melaporkan handshake yang sama baru, atau jam hub melenceng: pemilihan
  harus tetap stabil dan tidak berpindah-pindah tiap siklus. Kalau seri, hub yang
  sedang aktif dipertahankan (Task 10).
- Hub tidak terjangkau saat core mendaftarkan atau menghapus peer: operasi tidak
  boleh setengah jadi tanpa jejak. Peer yang gagal didaftarkan dicatat `sync_pending`
  dan dicoba ulang oleh reconcile (Task 8).
- Pool alamat hampir habis, atau alamat yang dilepas dipakai ulang terlalu cepat
  sementara `nas.nasname` lama masih ada di netmanager: alamat yang dilepas tidak
  dialokasikan ulang selama 7 hari (Task 2).
- Restart proses saat interface sudah ada: reconcile tidak boleh menghapus lalu
  membuat ulang interface, dan tidak boleh mengosongkan peer sebelum state dibaca
  (Task 6, Task 12).

---

### Task 1: Repo, device WireGuard, dan CI

**Files:**
- Create: `go.mod` (module `github.com/hadiahterlupakan/netmanager-vpn`, go 1.26)
- Create: `internal/wgdevice/device.go`, `device_linux.go`, `device_memory.go`, `device_other.go`, disalin dari `tikman/backend/internal/connectivity/wireguard_device*.go`, dengan package diganti menjadi `wgdevice`
- Create: `internal/wgdevice/device_memory_test.go`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `wgdevice.Device` (`Apply(cfg Config) error`, `Status(iface string) ([]PeerStatus, error)`); `Config{InterfaceName, PrivateKey, Address string; ListenPort, MTU int; Peers []PeerConfig}`; `PeerConfig{PublicKey string; AllowedIPs []string; Endpoint string; Keepalive time.Duration}`; `PeerStatus{PublicKey string; LastHandshakeAt *time.Time; RxBytes, TxBytes int64}`; `wgdevice.NewLinux() Device`; `wgdevice.NewMemory() *Memory` (with `Last() Config`, `SetStatus([]PeerStatus)`)

- [ ] **Step 1: Minta persetujuan pemilik** untuk membuat repo GitHub private `HadiahTerlupakan/netmanager-vpn`, dan memilih image GHCR private (VPS butuh token pull di perintah instal) atau public (kode tanpa rahasia). Catat jawabannya di README repo.
- [ ] **Step 2: Salin device dari tikman.** Tambahkan field `MTU` (diterapkan dengan `netlink.LinkSetMTU` di `ensureLink`) dan `Endpoint` (dipakai `wg-up` ke core). Endpoint yang berupa hostname di-resolve saat Apply.
- [ ] **Step 3: Tulis tes memory device**: `TestMemoryRecordsLastConfig` (Apply dua kali → `Last()` sama dengan config kedua) dan `TestMemoryStatusReturnsSet`.
- [ ] **Step 4: Jalankan** `go test ./... && go vet ./... && test -z "$(gofmt -s -l .)"`. Expected: PASS, dan keluaran gofmt kosong.
- [ ] **Step 5: CI** menjalankan `go test -race ./...`, `go vet`, `gofmt -s -l`, `go mod verify`, dan `GOOS=linux go build ./cmd/...`.
- [ ] **Step 6: Commit** dengan pesan `feat: device WireGuard dan CI`.

### Task 2: Alokasi alamat

**Files:**
- Create: `internal/ipam/ipam.go`, `internal/ipam/ipam_test.go`

**Interfaces:**
- Produces: `ipam.RouterPool = netip.MustParsePrefix("10.100.0.0/14")`, `ipam.BackhaulPool` (`10.99.0.0/24`), `ipam.AdminPool` (`10.99.128.0/24`); `func Allocate(pool netip.Prefix, first, last netip.Addr, taken map[netip.Addr]time.Time, now time.Time) (netip.Addr, error)`. `taken` memetakan alamat ke waktu dilepas, dengan nilai nol berarti masih dipakai. `var ErrExhausted`.

- [ ] **Step 1: Tulis tes**:
  - `TestAllocateSkipsTaken`: `.2` dan `.3` dipakai → hasilnya `.4`.
  - `TestAllocateBackhaulRange`: first `.2`, last `.126`; semua terpakai → `ErrExhausted`.
  - `TestAllocateHoldsReleasedForSevenDays`: alamat dilepas 6 hari lalu dilewati; yang dilepas 8 hari lalu boleh dipakai.
  - `TestAllocateRouterPoolFirstIsNotNetworkAddress`: hasil pertama dari RouterPool = `10.100.0.1`.
- [ ] **Step 2: Jalankan tes, pastikan FAIL**, lalu implementasikan dengan pencarian linear dari `first`. Masa tahan memakai konstanta `releaseHold = 7 * 24 * time.Hour`.
- [ ] **Step 3: Jalankan** `go test ./internal/ipam/`. Expected: PASS.
- [ ] **Step 4: Commit** dengan pesan `feat(ipam): alokasi alamat backhaul, router, admin`.

### Task 3: Enkripsi rahasia

**Files:**
- Create: `internal/secret/secret.go`, `internal/secret/secret_test.go`

**Interfaces:**
- Produces: `func NewBox(base64Key string) (*Box, error)`, `(*Box) Seal(plain string) (string, error)`, `(*Box) Open(sealed string) (string, error)`. AES-256-GCM, nonce acak di depan, base64.

- [ ] **Step 1: Tulis tes**: `TestSealOpenRoundTrip`, `TestOpenRejectsTampered` (satu byte diubah → error), `TestNewBoxRejectsShortKey` (16 byte → error).
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(secret): AES-256-GCM untuk private key`.

### Task 4: Store SQLite

**Files:**
- Create: `internal/store/store.go` (Open + migrasi berurutan), `internal/store/core.go`, `internal/store/hub.go`, `internal/store/store_test.go`

**Interfaces:**
- Produces: `store.Open(path string) (*Store, error)` dengan WAL dan `busy_timeout=5000`.
- Tabel core:
  - `server_keys(iface, private_key)`;
  - `hubs(id, name, public_host, listen_port, backhaul_addr, public_key, private_key, api_token, status, join_expires_at, last_seen_at, created_at)`;
  - `routers(id, label, ref, address, public_key, private_key, status, created_at, released_at)`;
  - `router_hubs(router_id, hub_id, priority, sync_state)`;
  - `router_events(id, router_id, from_hub_id, to_hub_id, at)`;
  - `admin_peers(id, label, address, public_key, private_key, created_at)`.
- Tabel hub:
  - `hub_config(core_public_key, core_endpoint, backhaul_addr, api_token, private_key_up, private_key_nm)`;
  - `peers(public_key, address, created_at)`.
- Metode CRUD bertipe:
  - core: `CreateHub`, `ListHubs`, `GetHub`, `UpdateHubStatus`, `DeleteHub`, `CreateRouter`, `GetRouter`, `ListRouters`, `SetRouterHubs`, `ClaimRouter`, `DeleteRouter`, `AddRouterEvent`, `ListRouterEvents`, `TakenAddresses(kind) map[netip.Addr]time.Time`, `CreateAdminPeer`, `ListAdminPeers`, `DeleteAdminPeer`;
  - hub: `SaveHubConfig`, `LoadHubConfig`, `UpsertPeer`, `DeletePeer`, `ListPeers`.
- Kolom kunci menyimpan nilai yang sudah di-`Seal`. Store tidak tahu soal enkripsi.

- [ ] **Step 1: Tulis tes**:
  - `TestMigrateIsIdempotent`: Open dua kali pada file yang sama tidak menghasilkan error.
  - `TestDeleteHubRefusedWhileReferenced`: `router_hubs` merujuk hub → `ErrInUse`.
  - `TestDeleteRouterKeepsReleasedAt`: `TakenAddresses` mengembalikan alamat dengan `released_at` terisi.
  - `TestSetRouterHubsReplacesOrder`: urutan `[B,A]` disimpan dengan priority 0,1.
- [ ] **Step 2: Implementasikan**, lalu jalankan `go test ./internal/store/`. Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(store): skema SQLite core dan hub`.

### Task 5: Ruleset nftables

**Files:**
- Create: `internal/firewall/render.go`, `internal/firewall/apply_linux.go`, `internal/firewall/render_test.go`, `internal/firewall/testdata/hub.nft` (salinan `vpn-hub.nft` dari spike), `testdata/core.nft`

**Interfaces:**
- Produces: `func RenderHub(backhaulAddr netip.Addr) string`; `func RenderCore() string`; `type Applier interface{ Apply(ruleset string) error }`; `NewNft() Applier` yang menjalankan `nft -f -` dengan ruleset diawali `table inet netmanager_vpn` + `flush table inet netmanager_vpn`, supaya penerapannya atomik dan tidak menyentuh tabel lain (kube-proxy, docker).
- Isi `RenderCore`, di dalam chain `input`:
  - `tcp dport 7480 ip saddr { 127.0.0.1, 10.42.0.0/16 } accept`;
  - `tcp dport 7480 drop`.

  Selain itu tidak ada rule.
- `RenderHub` menambahkan rule berikut ke ruleset spike di chain `input`:
  - `iifname "wg-up" ip saddr 10.99.0.1 tcp dport 7480 accept`;
  - `tcp dport 7480 drop`.

- [ ] **Step 1: Tulis tes golden**: `TestRenderHubMatchesSpike` (keluaran = `testdata/hub.nft`), `TestRenderCoreMatchesGolden`, dan `TestRulesetsAreStateless` (keluaran tidak mengandung `ct state`).
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(firewall): ruleset nftables core dan hub`.

### Task 6: Mode hub

**Files:**
- Create: `internal/hub/hub.go` (Service: Join, Reconcile, peer ops), `internal/hub/api.go` (HTTP), `internal/hub/hub_test.go`, `internal/hub/api_test.go`
- Create: `internal/joinbundle/bundle.go`, `bundle_test.go`

**Interfaces:**
- Consumes: `wgdevice.Device`, `store.Store`, `firewall.Applier`, `secret.Box`.
- Produces:
  - `joinbundle.Bundle{CoreEndpoint, CorePublicKey, BackhaulAddr, UpPrivateKey, NmPrivateKey, APIToken string; ExpiresAt time.Time}`, dengan `Encode() string` (base64url JSON) dan `Decode(s string) (Bundle, error)`.
  - `hub.New(dev, st, fw, box) *Service`, `(*Service) Join(b joinbundle.Bundle) error`, `(*Service) Reconcile() error`, `(*Service) UpsertPeer(pub string, addr netip.Addr) error`, `(*Service) DeletePeer(pub string) error`, `(*Service) PeerStatuses() ([]PeerStatus, error)`.
  - HTTP (bearer = `api_token`):
    - `PUT /v1/peers/{pub}` `{"address":"10.100.0.10"}`;
    - `DELETE /v1/peers/{pub}`;
    - `GET /v1/peers` → `[{"publicKey","address","lastHandshakeAt","rxBytes","txBytes"}]`;
    - `GET /healthz`.
- `Reconcile` menerapkan `wg-up` (peer core, `allowed-ips 10.99.0.0/24,10.99.128.0/24`, endpoint dari bundle, keepalive 25 s) dan `wg-nm` (satu peer per baris `peers`, `allowed-ips` = alamat/32), lalu ruleset hub, dan menyalakan `net.ipv4.ip_forward=1`.

- [ ] **Step 1: Tulis tes**:
  - `TestBundleRoundTrip`.
  - `TestReconcileBuildsBothInterfaces`: memory device menerima config `wg-nm` dengan peer `10.100.0.10/32` dan `wg-up` dengan endpoint core.
  - `TestReconcileWithEmptyStoreDoesNotWipeBeforeLoad`: store gagal dibaca → `Apply` tidak dipanggil.
  - `TestAPIRejectsMissingToken`: 401.
  - `TestAPIUpsertIsIdempotent`: PUT dua kali → satu peer.
- [ ] **Step 2: Implementasikan, lalu jalankan** `go test ./internal/hub/ ./internal/joinbundle/`. Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(hub): join, reconcile, dan API peer`.

### Task 7: Core — registry hub

**Files:**
- Create: `internal/core/hubs.go`, `internal/core/hubclient.go` (klien HTTP ke API hub, timeout 5 s), `internal/core/hubs_test.go`

**Interfaces:**
- Consumes: `store`, `ipam`, `secret`, `joinbundle`, `wgdevice`.
- Produces:
  - `type HubClient interface{ UpsertPeer(ctx, hub Hub, pub string, addr netip.Addr) error; DeletePeer(ctx, hub Hub, pub string) error; Peers(ctx, hub Hub) ([]PeerStatus, error) }`;
  - `(*Core) CreateHub(name, publicHost string, port int) (Hub, string /*installCommand*/, error)`;
  - `(*Core) ReissueJoin(id string) (string, error)`;
  - `(*Core) DeleteHub(id string) error` (meneruskan `store.ErrInUse`);
  - `(*Core) ListHubs() ([]HubView, error)`, dengan `HubView{ID, Name, PublicHost string; ListenPort int; Status string; RouterCount int; LastSeenAt *time.Time}`.
- Status hub:
  - `pending_install` sampai handshake pertama di `wg-core`;
  - `online` kalau handshake < 180 s;
  - `offline` kalau lebih lama;
  - `expired` kalau `pending_install` sudah melewati `join_expires_at`, dan dalam kondisi ini kunci join tidak lagi diterima.
- `installCommand` memakai template `curl -fsSL <INSTALL_URL> | sudo sh -s -- <bundle>`. `INSTALL_URL` diambil dari env `NMVPN_INSTALL_URL` (raw `deploy/install-hub.sh` di repo atau rilis).

- [ ] **Step 1: Tulis tes**:
  - `TestCreateHubAllocatesBackhaulAndAddsPeer`: alamat pertama `10.99.0.2`, dan memory device `wg-core` punya peer dengan `allowed-ips` `10.99.0.2/32`.
  - `TestHubStatusTransitions` (tabel: tanpa handshake → `pending_install`; 30 s → `online`; 10 menit → `offline`; tanpa handshake melewati expiry → `expired`).
  - `TestReissueRotatesHubKeys`.
  - `TestDeleteHubInUse` → `ErrInUse`.
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(core): registry hub dan perintah instal`.

### Task 8: Core — router dan daftar server

**Files:**
- Create: `internal/core/routers.go`, `internal/core/routers_test.go`

**Interfaces:**
- Consumes: `HubClient` (Task 7).
- Produces:
  - `(*Core) CreateRouter(ctx, label string, hubIDs []string) (RouterView, error)`;
  - `(*Core) SetRouterHubs(ctx, id string, hubIDs []string) error`;
  - `(*Core) ClaimRouter(id, ref string) error`;
  - `(*Core) DeleteRouter(ctx, id string) error`;
  - `(*Core) GetRouter(id string) (RouterView, error)`;
  - `(*Core) ExpirePending(ctx, now time.Time) (int, error)`;
  - `(*Core) SyncPending(ctx) error`.
- `RouterView{ID, Label, Ref, Address, Status /*pending|active*/ string; Hubs []RouterHub; ActiveHubID *string; LastHandshakeAt *time.Time; Events []RouterEvent}`, `RouterHub{HubID, Name string; Priority int; SyncState string}`, `RouterEvent{FromHubID, ToHubID *string; At time.Time}`.
- Aturan:
  - `hubIDs` minimal 1, tanpa duplikat, dan semua berstatus `online`. Kalau tidak, `ErrValidation`.
  - Satu keypair per router, dipakai di semua hub.
  - Hub yang gagal dipanggil disimpan dengan `sync_state=pending` dan dicoba lagi oleh `SyncPending`. Operasi tetap sukses ke pemanggil, dan `RouterView` menampilkan `syncState`.

- [ ] **Step 1: Tulis tes** dengan fake `HubClient`:
  - `TestCreateRouterRegistersOnEveryHub`: dua hub → dua `UpsertPeer` dengan pubkey dan alamat yang sama.
  - `TestCreateRouterRejectsOfflineHub`.
  - `TestCreateRouterRejectsDuplicateHub`.
  - `TestUnreachableHubMarkedPendingThenSynced`: fake gagal sekali → `sync_state=pending`; `SyncPending` → `synced`.
  - `TestSetRouterHubsRemovesDroppedHub`: `[A,B]` → `[B]` → `DeletePeer` di A.
  - `TestExpirePendingAfter24h`: 23 jam tetap ada; 25 jam dihapus dari store dan hub.
  - `TestClaimedRouterNotExpired`.
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(core): router, daftar server, dan claim`.

### Task 9: Render script RouterOS

**Files:**
- Create: `internal/routeros/render.go`, `internal/routeros/render_test.go`, `internal/routeros/testdata/full.rsc`, `testdata/scheduler.rsc` (dari golden spike, dengan kunci uji)

**Interfaces:**
- Produces:
  - `routeros.Server{Host string; Port int; PublicKey string}`;
  - `routeros.Input{Label string; Address netip.Addr; PrivateKey string; Servers []Server}`;
  - `func RenderFull(in Input) string`: bagian dasar spike untuk loopback, WireGuard ke `Servers[0]`, routing table, rule, dan route, ditambah scheduler. **Tanpa** bagian user API, karena bagian itu milik netmanager;
  - `func RenderScheduler(in Input) string`: hanya `/system scheduler` + sumber script dengan daftar server, yang dipakai netmanager untuk update lewat API;
  - `func quote(s string) string`: escape `\`, `"`, dan `$` untuk string RouterOS.

- [ ] **Step 1: Tulis tes**:
  - `TestRenderFullMatchesGolden` dan `TestRenderSchedulerMatchesGolden`.
  - `TestRenderHasNoFetchOrImport`: keluaran tidak mengandung `/tool fetch` maupun `/import`.
  - `TestRenderQuotesLabel`: label `a"b$c` muncul sebagai `a\"b\$c`.
  - `TestRenderServerOrderPreserved`: urutan host di daftar = urutan input.
  - `TestRenderStartsWithRemovals`: baris pertama menghapus objek ber-komentar `netmanager-vpn`.
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(routeros): render script dasar dan scheduler auto switch`.

### Task 10: Pengendali hub aktif

**Files:**
- Create: `internal/core/active.go`, `internal/core/active_test.go`

**Interfaces:**
- Produces:
  - `func ChooseActive(handshakes map[string]time.Time, current *string, now time.Time) *string`, yaitu fungsi murni;
  - `(*Core) RunActiveLoop(ctx context.Context, interval time.Duration)`, yang setiap tick memanggil `Peers` di semua hub online, menghitung hub aktif per router, membangun ulang config `wg-core` (peer hub = backhaul/32 + `/32` router yang aktif di sana; peer admin), memanggil `Apply`, dan menulis `router_events` saat hub aktif berubah. Satu hub gagal dibaca dianggap tanpa handshake untuk tick itu.
- Aturan `ChooseActive`:
  - abaikan handshake ≥ 180 s;
  - pilih yang terbaru;
  - kalau `current` masih < 180 s dan selisihnya dengan yang terbaru ≤ 30 s, pertahankan `current`;
  - kalau tidak ada yang segar, kembalikan `nil`.

- [ ] **Step 1: Tulis tes tabel `TestChooseActive`**:
  - tidak ada handshake → nil;
  - A 10 s, B 100 s → A;
  - current B (20 s), A (5 s) → B, karena selisih ≤ 30 s;
  - current B (170 s), A (5 s) → A;
  - semua 200 s → nil.
- [ ] **Step 2: Tulis `TestActiveLoopMovesRouterAndRecordsEvent`** (fake hub client + memory device): handshake pindah dari A ke B → `/32` berpindah di config `wg-core`, dan satu event A→B tercatat. Tick berikutnya tanpa perubahan tidak menambah event.
- [ ] **Step 3: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 4: Commit** dengan pesan `feat(core): pemilihan hub aktif dari handshake`.

### Task 11: Core — peer admin

**Files:**
- Create: `internal/core/admins.go`, `internal/core/admins_test.go`

**Interfaces:**
- Produces: `(*Core) CreateAdminPeer(label string) (AdminPeer, error)`, `(*Core) AdminConfig(id string) (string /*wg-quick*/, error)`, `(*Core) DeleteAdminPeer(id string) error`, `(*Core) ListAdminPeers() ([]AdminPeer, error)`.
- Isi config wg-quick:
  - `Address = 10.99.128.N/32`;
  - `[Peer]` core dengan `Endpoint = <NMVPN_CORE_ENDPOINT>:51822`;
  - `AllowedIPs = 10.99.0.0/24, 10.100.0.0/14`;
  - `PersistentKeepalive = 25`.

- [ ] **Step 1: Tulis tes**: `TestAdminPeerAllocatesFromAdminPool` (`10.99.128.1`), `TestAdminConfigContainsRouterPool`, dan `TestDeleteAdminPeerRemovesFromCore`.
- [ ] **Step 2: Implementasikan, lalu jalankan tes.** Expected: PASS.
- [ ] **Step 3: Commit** dengan pesan `feat(core): peer perangkat admin`.

### Task 12: API core dan `main`

**Files:**
- Create: `internal/core/api.go`, `internal/core/api_test.go`, `cmd/netmanager-vpn/main.go`

**Interfaces:**
- Produces (bearer `NMVPN_API_TOKEN`, JSON). Kontrak inilah yang dipakai rencana 3:
  - `GET /v1/hubs` → `[HubView]`
  - `POST /v1/hubs` `{name, publicHost, listenPort}` → `{hub: HubView, installCommand}`
  - `POST /v1/hubs/{id}/reissue` → `{installCommand}`
  - `DELETE /v1/hubs/{id}` → 204, atau 409 `{error:"in_use"}`
  - `POST /v1/routers` `{label, hubIds}` → `RouterView`
  - `GET /v1/routers/{id}` → `RouterView`
  - `PUT /v1/routers/{id}/hubs` `{hubIds}` → `RouterView`
  - `POST /v1/routers/{id}/claim` `{ref}` → `RouterView`
  - `DELETE /v1/routers/{id}` → 204
  - `GET /v1/routers/{id}/routeros?part=full|scheduler` → `text/plain`
  - `GET|POST /v1/admin-peers`, `DELETE /v1/admin-peers/{id}`, `GET /v1/admin-peers/{id}/config` → `text/plain`
  - `GET /healthz` → 200 kalau interface ada dan reconcile terakhir < 60 s lalu sukses
- Kode error: 400 untuk validasi, 401 untuk token salah, 404, 409 untuk in_use.
- `main`:
  - flag `-mode core|hub`;
  - `hub join <bundle>` sebagai subcommand sekali jalan;
  - env `NMVPN_ENCRYPTION_KEY`, `NMVPN_API_TOKEN` (core), `NMVPN_CORE_ENDPOINT`, `NMVPN_INSTALL_URL`, `NMVPN_STATE` (default `/var/lib/netmanager-vpn/state.db`);
  - saat start: Open store → Reconcile → firewall → loop aktif (core, 10 s), `ExpirePending` (core, tiap 10 menit), `SyncPending` (core, tiap 1 menit) → listen 7480 (core di `0.0.0.0` yang dijaga nft; hub di alamat backhaul).

- [ ] **Step 1: Tulis tes HTTP dengan `httptest`**:
  - `TestCoreAPIRequiresToken`;
  - `TestCreateRouterValidationIs400`;
  - `TestDeleteHubInUseIs409`;
  - `TestRouterOSEndpointIsPlainText`;
  - `TestHealthzFailsWhenReconcileStale`.
- [ ] **Step 2: Implementasikan handler dan `main`.** Jalankan `go test ./... -race` dan `GOOS=linux go build ./cmd/netmanager-vpn`. Expected: PASS, build sukses.
- [ ] **Step 3: Commit** dengan pesan `feat: API core dan entry point`.

### Task 13: Image, manifest core, instal hub, deploy

**Files:**
- Create: `Dockerfile` (build Go → `alpine:3.20` + `nftables`)
- Create: `deploy/k8s/core.yaml`: namespace `netmanager-vpn`; Secret ref `netmanager-vpn-secrets`; Deployment replica 1 dengan `strategy: Recreate`, `hostNetwork: true`, `dnsPolicy: ClusterFirstWithHostNet`, `securityContext.capabilities.add: [NET_ADMIN]`, hostPath `/var/lib/netmanager-vpn`, liveness `/healthz`; Service ClusterIP `netmanager-vpn:7480`; CronJob harian yang menjalankan `netmanager-vpn backup` (subcommand: `VACUUM INTO` ke `/var/backups/netmanager-vpn/state-<tanggal>.db`, simpan 7 hari) dengan hostPath yang sama
- Create: `deploy/install-hub.sh`: cek root, `systemd-detect-virt` ∉ {openvz, lxc}, kernel ≥ 5.6, `modprobe wireguard`; pasang Docker bila belum ada; `docker run -d --name netmanager-vpn-hub --restart unless-stopped --network host --cap-add NET_ADMIN -v /var/lib/netmanager-vpn:/var/lib/netmanager-vpn <image> hub join <bundle>` lalu mode hub; cadangan harian `state.db` ke `/var/backups/netmanager-vpn` via cron
- Create: `deploy/netmanager-vpn-deploy.sh` (pola `netmanager/scripts/deploy/netmanager-deploy.sh`: forced command, input SHA 40 hex, image dari GHCR, `kubectl apply` hanya `deploy/k8s/core.yaml` dari commit itu)
- Create: `.github/workflows/build-image.yml`
- Create: `README.md` (cara instal core dan hub, dan prasyarat firewall provider: UDP 51822 di radpro, UDP 51821 di hub). README dibuat karena repo baru; tidak ada dokumen lain.

- [ ] **Step 1: Tulis `TestInstallScriptRejectsOpenVZ`** sebagai tes shell di CI: jalankan `install-hub.sh` dengan `systemd-detect-virt` palsu di PATH yang mengeluarkan `openvz`. Expected: exit ≠ 0 dengan pesan "VPS harus KVM".
- [ ] **Step 2: Bangun image di CI**, lalu verifikasi dengan `docker run --rm <image> -h`, yang harus menampilkan flag `-mode`.
- [ ] **Step 3: Commit** dengan pesan `feat(deploy): image, manifest core, instal hub`.

### Task 14: Uji ujung ke ujung di infrastruktur spike

**Files:** tidak ada.

- [ ] **Step 1: Persiapan (dengan persetujuan pemilik).** Buat Secret `netmanager-vpn-secrets` di radpro, lalu deploy core lewat skrip deploy. `kubectl -n netmanager-vpn get pods` harus Running, dan `ip link show wg-core` harus ada di host.
- [ ] **Step 2: Daftarkan dua hub** dengan `POST /v1/hubs` dua kali (curl dari pod sementara di namespace netmanager-production). Jalankan `installCommand` di VPS A dan B. Dalam ≤ 2 menit, `GET /v1/hubs` harus menampilkan keduanya `online`.
- [ ] **Step 3: Daftarkan router.** Panggil `POST /v1/routers {label:"uji", hubIds:[A,B]}`, lalu `GET .../routeros?part=full`. Tambahkan bagian user API dari script spike, lalu tempel ke router uji. `GET /v1/routers/{id}` harus menampilkan `activeHubId = A`.
- [ ] **Step 4: Uji failover.** Hentikan container hub A (`docker stop netmanager-vpn-hub`), lalu cek:
  - `activeHubId` menjadi B dalam ≤ 80 s;
  - ada satu event A→B;
  - test koneksi netmanager ke IP router sukses.

  Kemudian `docker start` hub A, tunggu 3 menit, dan pastikan tetap di B.
- [ ] **Step 5: Restart tanpa putus.** Lakukan `kubectl -n netmanager-vpn rollout restart deploy/netmanager-vpn` sambil `ping` terus dari router ke `10.99.0.1`. Expected: tidak ada paket hilang selama restart, karena interface tetap hidup di host.
- [ ] **Step 6: Bersihkan** dengan `DELETE /v1/routers/{id}`, lalu catat hasilnya di file hasil spike, di bagian "Uji service".
