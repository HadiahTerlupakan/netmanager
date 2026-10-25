# Layanan Isolir (mode Server isolir) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pelanggan isolir di router VPN mendapat halaman isolir tenant dari layanan sendiri (HTTP dan HTTPS) lewat tunnel, tanpa web proxy RouterOS.

**Architecture:** Router mode `ISOLIR_SERVICE` men-dst-nat TCP 80/443 pelanggan isolir ke `10.99.0.1:30880/30443` dan me-masquerade-nya ke IP overlay router. Hub dan core `netmanager-vpn` membuka dua port itu. Layanan Go `netmanager-isolir` (NodePort, `externalTrafficPolicy: Local`) menjawab setiap permintaan dengan HTML yang diambil dari endpoint internal netmanager menurut IP sumber, dengan cache.

**Tech Stack:** netmanager (Next.js 16, TypeScript, Prisma, vitest, node-routeros-v2); netmanager-vpn (Go 1.26, nftables goldens); netmanager-isolir (Go 1.26, stdlib saja, k3s).

**Spec:** `docs/superpowers/specs/2026-10-25-layanan-isolir-design.md`

## Global Constraints

- Mode baru: enum Prisma `IsolirMode` nilai `ISOLIR_SERVICE`, label UI "Server isolir"; default mode tetap `ROUTER_PAGE`.
- `ISOLIR_SERVICE` hanya untuk router `connectionMode = VPN`; router non-VPN yang menyimpan mode ini jatuh ke `ROUTER_PAGE` saat provisioning dan log provisioning mencatatnya.
- Alamat layanan dari sisi router: `getVpnCoreAddress()` (default `10.99.0.1`); NodePort HTTP **30880**, HTTPS **30443**.
- Jaringan isolir `10.127.0.0/18`; nama rule baru persis: `netmanager-redirect-expired-https`, `netmanager-masquerade-isolir`, `netmanager-isolir-mss`; rule HTTP tetap `netmanager-redirect-expired`.
- Endpoint: `GET /api/internal/isolir/page?address=<ipv4>`, `Authorization: Bearer <ISOLIR_SERVICE_TOKEN>`, token ≥ 32 karakter, terpisah dari `VPN_API_TOKEN`.
- Layanan: cache 60 detik per IP sumber, cache lama dipakai sampai 24 jam bila netmanager gagal, lalu halaman cadangan dengan teks persis: "Layanan internet Anda sedang diisolir. Silakan hubungi penyedia layanan Anda."
- Setiap jawaban layanan: status 200, `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, tanpa header `Server`; tidak ada koneksi keluar selain ke netmanager.
- Layanan tidak memakai database dan tidak menyimpan data pelanggan; log hanya hitungan per router dan galat.
- Satu sertifikat self-signed untuk semua nama; tidak ditolak berdasarkan SNI.
- Pod layanan: `nodeSelector: kubernetes.io/hostname: radpro`.
- Bahasa UI/log/komentar mengikuti repo masing-masing (netmanager: Indonesia).
- **Langkah yang menyentuh produksi** (membuat repo GitHub, push ke `main` repo mana pun, apply manifest, rilis hub, mengubah router lab) **berhenti dan meminta izin pemilik per langkah.** Commit lokal boleh.

## Review Focus

1. HTTPS dengan SNI situs ber-HSTS (mis. `www.google.com`): handshake tetap selesai dengan sertifikat kita, dan halaman tersaji setelah klien mengabaikan verifikasi → Task 7.
2. Netmanager lambat/menggantung: pelanggan tidak ikut menggantung; fetch berbatas 3 detik, lalu cache lama atau halaman cadangan → Task 6.
3. Banyak permintaan bersamaan dari satu router saat cache kedaluwarsa: hanya satu fetch ke netmanager → Task 6.
4. Router pindah dari `ISOLIR_SERVICE` kembali ke `ROUTER_PAGE`: rule HTTPS, masquerade isolir, dan mangle MSS terhapus; rule HTTP kembali ke redirect 8181; web proxy dan guard kembali → Task 2 dan Task 3.
5. Parameter `address` tidak valid (kosong, IPv6, teks) → 400; IPv4 valid tapi tak dikenal → halaman default → Task 4.

---

## Repo A: netmanager (worktree `/Users/rohadimraja/Documents/radpro/netmanager-api-test-fix`, branch baru `feat/layanan-isolir` dari `origin/main`)

### Task 1: Mode `ISOLIR_SERVICE` di skema, validasi, dan form

**Files:**
- Modify: `prisma/schema.prisma` (enum `IsolirMode`) + migrasi baru di `prisma/migrations/`
- Modify: `modules/network/domain/entities/MikroTikRouterEntity.ts` (`RouterIsolirMode`), `modules/network/domain/ports/IVpnRouterMigrationRepository.ts`
- Modify: `lib/validations/mikrotik.ts`
- Modify: service update router (cari pemanggil `mikrotikRouterUpdateSchema`; tolak mode ini bila router bukan VPN)
- Modify: `app/admin/network/mikrotik/components/IsolirModeField.tsx` dan pemakainya (new/edit client)
- Test: `tests/lib/validations/mikrotik.test.ts` (atau file validasi yang sudah ada), test service update yang sudah ada, test komponen bila ada

**Interfaces:**
- Produces: `IsolirMode` = `"ROUTER_PAGE" | "REDIRECT" | "ISOLIR_SERVICE"` di Prisma, domain, dan UI.

- [ ] **Step 1: Tulis test gagal**
  - `mikrotikRouterCreateSchema` menolak `{ connectionMode: "PUBLIC", isolirMode: "ISOLIR_SERVICE" }` dengan issue pada path `["isolirMode"]`, pesan `"Mode Server isolir hanya untuk router VPN"`.
  - Menerima `ISOLIR_SERVICE` untuk input VPN yang sah.
  - Update router PUBLIC ke `ISOLIR_SERVICE` gagal `ValidationError` dengan pesan yang sama; router VPN berhasil.
  - `IsolirModeField` hanya menampilkan opsi "Server isolir" bila prop `connectionMode === "VPN"`.
- [ ] **Step 2:** Jalankan `npx vitest run <file-file test di atas>` → FAIL.
- [ ] **Step 3:** Tambah nilai enum + migrasi (`ALTER TYPE "IsolirMode" ADD VALUE 'ISOLIR_SERVICE'`), perluas tipe domain, schema zod, cek service update, dan opsi form (prop baru `connectionMode` pada `IsolirModeField`). Jalankan `npm run prisma:generate`; client hasil generate ikut di-commit.
- [ ] **Step 4:** Test lulus; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` bersih.
- [ ] **Step 5:** Commit `feat(isolir): mode Server isolir untuk router VPN`.

### Task 2: Provisioning NAT dan mangle per mode

**Files:**
- Create: `modules/network/isolir/isolir-service.constants.ts` (`ISOLIR_SERVICE_HTTP_PORT = 30880`, `ISOLIR_SERVICE_HTTPS_PORT = 30443`)
- Modify: `modules/network/isolir/isolir-provisioning.ts`
- Modify: `modules/network/services/mikrotik-provisioning.nat.ts`
- Test: `tests/modules/network/mikrotik-provisioning-nat.test.ts` (buat bila belum ada, pola fake router seperti `mikrotik-provisioning-firewall.test.ts`), test `isolir-provisioning` yang sudah ada

**Interfaces:**
- Consumes: `IsolirMode` (Task 1).
- Produces:
  - `IsolirProvisioning` tambahan varian `{ mode: "ISOLIR_SERVICE"; address: string }`.
  - `resolveIsolirProvisioning(router: { isolirMode; isolirUrl; tenantId; connectionMode })`: `ISOLIR_SERVICE` + VPN → `{ mode: "ISOLIR_SERVICE", address: getVpnCoreAddress() }`; non-VPN → `logger.warn` lalu `ROUTER_PAGE`. Pemanggil yang belum memilih `connectionMode` di selector-nya diperbarui.
  - `provisionNatRules({ connection, logs, isolir: IsolirProvisioning | null })`.

- [ ] **Step 1: Tulis test gagal** (fake router mencatat `/ip/firewall/nat/*` dan `/ip/firewall/mangle/*`):
  - Mode `ISOLIR_SERVICE`: rule `netmanager-redirect-expired` berargs `=chain=dstnat`, `=action=dst-nat`, `=to-addresses=10.99.0.1`, `=to-ports=30880`, `=protocol=tcp`, `=src-address=10.127.0.0/18`, `=dst-address-list=!netmanager_allow`, `=dst-port=80`; rule `netmanager-redirect-expired-https` sama dengan `=to-ports=30443`, `=dst-port=443`; `netmanager-masquerade-isolir` berargs `=chain=srcnat`, `=action=masquerade`, `=protocol=tcp`, `=src-address=10.127.0.0/18`, `=dst-address=10.99.0.1`, `=dst-port=30880,30443` dan ditempatkan paling atas (`place-before` rule pertama); mangle `netmanager-isolir-mss` berargs `=chain=forward`, `=action=change-mss`, `=new-mss=clamp-to-pmtu`, `=passthrough=yes`, `=protocol=tcp`, `=tcp-flags=syn`, `=src-address=10.127.0.0/18`, `=dst-address=10.99.0.1`, `=dst-port=30880,30443`.
  - Mode `ROUTER_PAGE` pada router yang sebelumnya `ISOLIR_SERVICE`: rule HTTP di-set kembali ke redirect 8181 (args sekarang), dan ketiga rule mode servis (`-https`, `masquerade-isolir`, mangle) dihapus.
  - `isolir = null`: rule bermode tidak disentuh; `netmanager-masquerade` tetap dipastikan.
  - `removeNatRules` juga menghapus `-https`, `masquerade-isolir`, dan mangle.
  - `resolveIsolirProvisioning` untuk `ISOLIR_SERVICE` + `PUBLIC` → `ROUTER_PAGE`.
- [ ] **Step 2:** `npx vitest run tests/modules/network/mikrotik-provisioning-nat.test.ts tests/modules/network/isolir-provisioning*.test.ts` → FAIL.
- [ ] **Step 3:** Implementasi: daftar rule dibangun dari mode; rule HTTP tetap satu comment dan dipulihkan lewat `restoreRows` seperti sekarang; rule milik mode lain dihapus per comment. Mangle memakai pola `ensure/restore` yang sama di path `/ip/firewall/mangle`.
- [ ] **Step 4:** Test lulus.
- [ ] **Step 5:** Commit `feat(isolir): rule NAT dan MSS untuk mode Server isolir`.

### Task 3: Web proxy dan guard pada mode Server isolir

**Files:**
- Create: `modules/network/services/mikrotik-provisioning.proxy-guard.ts` (`ensureProxyGuard(connection, logs)`, `removeProxyGuard(connection, logs)`; args guard dipindah ke sini dari `mikrotik-provisioning.firewall.ts`, firewall memakainya)
- Modify: `modules/network/services/mikrotik-provisioning.firewall.ts` (`ensureFilterRules` melewati guard bila `isolir?.mode === "ISOLIR_SERVICE"`)
- Modify: `modules/network/services/MikroTikProvisioningService.ts` (`provisionRadius`)
- Test: `tests/modules/network/mikrotik-provisioning-firewall.test.ts`, test `MikroTikProvisioningService` yang sudah ada

**Interfaces:**
- Consumes: varian `ISOLIR_SERVICE` (Task 2), `removeWebProxy(): Promise<boolean>` (sudah ada).

- [ ] **Step 1: Tulis test gagal**
  - `ISOLIR_SERVICE`: `provisionRadius` memanggil `removeWebProxy`; bila `true`, guard `netmanager-proxy-guard` dihapus; bila `false`, guard dipastikan ada dan hasil provisioning membawa `isolirPageError` `"Web proxy gagal dimatikan; guard 8181 dipertahankan"`. `provisionWebProxy` dan penulisan `error.html` tidak dipanggil. `provisionNatRules` menerima `isolir`.
  - Firewall mode `ISOLIR_SERVICE` tidak menambah guard; mode lain tetap menambah/memulihkan guard (test yang ada tetap hijau).
  - Router `ISOLIR_SERVICE` lalu `ROUTER_PAGE`: web proxy kembali di-enable dan guard ada lagi.
- [ ] **Step 2:** Jalankan test terkait → FAIL.
- [ ] **Step 3:** Implementasi sesuai interface.
- [ ] **Step 4:** Test lulus; jalankan `npx vitest run tests/modules/network` penuh.
- [ ] **Step 5:** Commit `feat(isolir): matikan web proxy dan guard pada mode Server isolir`.

### Task 4: Endpoint halaman untuk layanan isolir

**Files:**
- Create: `app/api/internal/isolir/page/route.ts`
- Create: `modules/network/isolir/IsolirServicePageService.ts`
- Modify: `modules/network/isolir/IsolirPageRepository.ts` (`findTenantIdByVpnAddress(address: string): Promise<{ tenantId: string | null } | null>` — `MikroTikRouter.vpnAddress = address`)
- Modify: `lib/env.ts` (`ISOLIR_SERVICE_TOKEN: z.string().min(32).optional()`), `k8s/production/app-deployment.yaml` (env `ISOLIR_SERVICE_TOKEN` dari `netmanager-secrets`, `optional: true`), `k8s/production/secrets.yaml` (placeholder `REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY`)
- Test: `tests/app/api/internal/isolir-page.test.ts`, `tests/modules/network/isolir-service-page.test.ts`

**Interfaces:**
- Produces:
  - `IsolirServicePageService.getPage(address: string): Promise<{ html: string; hash: string }>`: router dikenal → `renderIsolirPage(await resolveIsolirContent(tenantId))`; tak dikenal → `resolveIsolirContent(null)`. Renderer yang sama dengan router (batas 24 KiB ikut berlaku — keputusan: halaman identik di kedua mode).
  - HTTP: 200 `text/html; charset=utf-8`, header `ETag: "<hash>"`, `Cache-Control: no-store`; `If-None-Match` yang sama → 304 tanpa body.

- [ ] **Step 1: Tulis test gagal**
  - Tanpa header / token salah → 401; `ISOLIR_SERVICE_TOKEN` tidak diset → 503; perbandingan token memakai `crypto.timingSafeEqual` (test: token dengan panjang berbeda → 401, bukan exception).
  - `address` kosong, `::1`, `abc`, `10.100.0.300` → 400.
  - `10.100.0.4` milik router tenant T → HTML berisi nama ISP tenant T dan ETag = hash.
  - `10.100.9.9` tak dikenal → HTML default ("Layanan Internet").
  - `If-None-Match` cocok → 304.
- [ ] **Step 2:** Jalankan kedua file test → FAIL.
- [ ] **Step 3:** Implementasi. Route memakai pola `app/api/scheduler/restock-check/route.ts` (tanpa session), bukan `createHandler({ auth: true })`. Pastikan `proxy.ts` tidak menghalangi `/api/internal/isolir/*` tanpa session (tambah test bila `proxy.ts` punya daftar path).
- [ ] **Step 4:** Test lulus; tsc dan lint bersih.
- [ ] **Step 5:** Commit `feat(isolir): endpoint internal halaman untuk layanan isolir`.

---

## Repo B: netmanager-vpn (`/Users/rohadimraja/Documents/radpro/netmanager-vpn`; buat worktree/branch `feat/isolir-ports` dari `origin/main` — checkout lokal tertinggal, jangan dipakai)

### Task 5: Buka TCP 30880/30443 ke 10.99.0.1 di hub dan core

**Files:**
- Modify: `internal/firewall/render.go` (`hubForwardWG`, `hubForwardPPP`, `coreWgIn`)
- Modify: `internal/firewall/testdata/hub.nft`, `hub-ppp.nft`, `core.nft`
- Test: `internal/firewall/render_test.go`

- [ ] **Step 1: Tulis test gagal**: `TestIsolirPortsOpenOnlyToCore` — `RenderHub(false)` dan `RenderHub(true)` memuat `iifname "wg-nm" oifname "wg-up" ip daddr 10.99.0.1 tcp dport { 30880, 30443 } accept` (dan versi `nmppp*`) **sebelum** baris `tcp flags & (syn | ack) == syn drop` interface yang sama; `RenderCore()` memuat `iifname "wg-core" ip saddr 10.100.0.0/14 ip daddr 10.99.0.1 tcp dport { 30880, 30443 } accept` sebelum `iifname "wg-core" drop`. Perbarui goldens.
- [ ] **Step 2:** `go test ./internal/firewall/` → FAIL.
- [ ] **Step 3:** Tambah tiga baris rule; perbarui komentar `RenderCore` ("admits router RADIUS, isolir page, and ping").
- [ ] **Step 4:** `go test -race ./... && go vet ./... && test -z "$(gofmt -s -l .)"` lulus.
- [ ] **Step 5:** Commit `feat(firewall): izinkan router ke layanan isolir 10.99.0.1:30880/30443`.

DOCKER-USER tidak berubah: `hubWGAccepts`/`hubPPPAccepts` sudah menerima seluruh `wg-nm↔wg-up`.

---

## Repo C: netmanager-isolir (baru, `/Users/rohadimraja/Documents/radpro/netmanager-isolir`, module `github.com/hadiahterlupakan/netmanager-isolir`, Go 1.26, tanpa dependensi luar)

Struktur:
- `cmd/netmanager-isolir/main.go` — konfigurasi dari env, menjalankan tiga listener.
- `internal/page/` — sumber halaman dari netmanager + cache.
- `internal/server/` — handler, batas per IP, server HTTP/HTTPS.
- `deploy/k8s/isolir.yaml`, `Dockerfile`, `.github/workflows/ci.yml`, `README.md` (cara deploy, membuat sertifikat dan Secret).

### Task 6: Sumber halaman dan cache

**Files:**
- Create: `go.mod`, `internal/page/fetcher.go`, `internal/page/cache.go`, `internal/page/fallback.go`
- Test: `internal/page/cache_test.go`, `internal/page/fetcher_test.go`

**Interfaces:**
- Produces:
  - `type Fetcher interface { Fetch(ctx context.Context, address, etag string) (Result, error) }`, `type Result struct { HTML []byte; ETag string; NotModified bool }`.
  - `NewHTTPFetcher(baseURL, token string, client *http.Client) Fetcher` — `GET {baseURL}/api/internal/isolir/page?address=…`, `Authorization: Bearer`, `If-None-Match`; non-200/304 → error; body dibatasi 1 MiB.
  - `NewCache(f Fetcher, ttl, staleFor, fetchTimeout time.Duration, now func() time.Time) *Cache`; `(*Cache).Page(ctx, address string) []byte` tidak pernah mengembalikan error.
  - `FallbackHTML []byte` — halaman cadangan berteks persis dari Global Constraints.

- [ ] **Step 1: Tulis test gagal** (fake fetcher + jam palsu):
  - Dalam 60 detik, permintaan kedua tidak memanggil fetcher.
  - Setelah 60 detik, fetch ulang dengan `If-None-Match`; `NotModified` memperpanjang entri tanpa mengganti HTML.
  - Fetch gagal pada umur 23 jam → HTML lama; pada umur 25 jam → `FallbackHTML`; belum pernah ada → `FallbackHTML`.
  - Fetcher yang menggantung: `Page` kembali dalam ≤ `fetchTimeout` + 100 ms (pakai `fetchTimeout = 50ms` di test) dengan cache lama/cadangan.
  - 50 goroutine `Page` bersamaan untuk alamat kedaluwarsa yang sama → fetcher dipanggil tepat sekali.
  - `HTTPFetcher` dengan `httptest.Server`: kirim header Authorization dan query `address`; 304 → `NotModified`; 500 → error; body 2 MiB → error.
- [ ] **Step 2:** `go test ./internal/page/` → FAIL.
- [ ] **Step 3:** Implementasi; deduplikasi fetch per alamat dengan map + `sync.Mutex` sendiri (tanpa `x/sync`). Nilai produksi: `ttl 60s`, `staleFor 24h`, `fetchTimeout 3s`.
- [ ] **Step 4:** `go test -race ./...` lulus.
- [ ] **Step 5:** `git init`, commit `feat: sumber halaman isolir dengan cache`.

### Task 7: Server HTTP/HTTPS, batas per IP, main

**Files:**
- Create: `internal/server/handler.go`, `internal/server/limit.go`, `internal/server/stats.go`, `cmd/netmanager-isolir/main.go`
- Test: `internal/server/handler_test.go`, `internal/server/limit_test.go`, `cmd/netmanager-isolir/main_test.go`

**Interfaces:**
- Consumes: `*page.Cache` (Task 6).
- Produces:
  - `NewHandler(pages interface{ Page(ctx context.Context, address string) []byte }, limiter *Limiter, stats *Stats) http.Handler` — IP sumber dari `r.RemoteAddr` (bukan header apa pun); method/host/path apa pun → 200 + header dari Global Constraints; limiter menolak → 429 tanpa body halaman.
  - `NewLimiter(ratePerSec float64, burst int, maxConnsPerIP int)` + `(*Limiter).WrapListener(net.Listener) net.Listener` (koneksi ke-`maxConnsPerIP+1` dari IP yang sama langsung ditutup).
  - `Stats`: hitungan permintaan per IP, dicetak ke log satu baris per IP setiap 5 menit lalu di-reset.
  - main: env `NETMANAGER_URL` (contoh `http://netmanager-app.netmanager-production.svc.cluster.local`), `NETMANAGER_TOKEN`, `TLS_CERT_FILE`, `TLS_KEY_FILE`; listener `:8080` (HTTP), `:8443` (TLS), `:8081` (`/healthz` saja, tidak dibuka di Service). Nilai: 20 req/detik, burst 40, 32 koneksi per IP; `ReadHeaderTimeout 5s`, `ReadTimeout 10s`, `WriteTimeout 10s`, `IdleTimeout 30s`, `MaxHeaderBytes 8192`. Env wajib hilang → keluar dengan pesan jelas.

- [ ] **Step 1: Tulis test gagal**
  - `GET http://x/apa/saja`, `POST /`, `HEAD /`, Host `www.google.com` → 200, HTML dari pages untuk IP `RemoteAddr`, `Cache-Control: no-store`, tanpa header `Server`.
  - TLS (`httptest.NewUnstartedServer` + `StartTLS` dengan sertifikat self-signed di test) dengan klien `ServerName: "www.google.com"`, `InsecureSkipVerify: true` → handshake sukses, 200.
  - Permintaan ke-41 dalam satu detik dari IP sama → 429; IP lain tetap 200.
  - Koneksi ke-33 dari IP yang sama ditutup; setelah satu ditutup, koneksi baru diterima.
  - Header `X-Forwarded-For` diabaikan untuk pemilihan halaman.
  - main: env `NETMANAGER_TOKEN` kosong → error berisi nama variabel.
- [ ] **Step 2:** `go test ./internal/server/ ./cmd/...` → FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** `go test -race ./... && go vet ./... && test -z "$(gofmt -s -l .)"` lulus.
- [ ] **Step 5:** Commit `feat: server HTTP/HTTPS halaman isolir`.

### Task 8: Image, CI, manifest k8s

**Files:**
- Create: `Dockerfile` (multi-stage seperti `netmanager-vpn`: `golang:1.26-alpine3.22` → `alpine:3.22`, `CGO_ENABLED=0`, user non-root `65532`)
- Create: `.github/workflows/ci.yml` (go mod verify, gofmt, vet, `go test -race`, build image tanpa push) dan `build-image.yml` (push ke `ghcr.io/hadiahterlupakan/netmanager-isolir:<sha12>-<epoch>` di `main`, rumus tag sama dengan `netmanager-vpn`)
- Create: `deploy/k8s/isolir.yaml`: Namespace `netmanager-isolir`; Deployment 1 replika, `nodeSelector kubernetes.io/hostname: radpro`, `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, drop ALL capabilities, probes ke `:8081/healthz`, Secret `netmanager-isolir-tls` (cert/key) dan `netmanager-isolir-token` (`NETMANAGER_TOKEN`); Service `type: NodePort`, `externalTrafficPolicy: Local`, port 80→8080 nodePort 30880, 443→8443 nodePort 30443.
- Create: `README.md`: tujuan, konfigurasi env, cara membuat sertifikat (`openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 -subj "/CN=isolir" -keyout tls.key -out tls.crt`) dan Secret, cara deploy.

- [ ] **Step 1:** `docker build .` berhasil; `docker run` lokal dengan env palsu menjawab `curl -s localhost:8080/apa` (halaman cadangan karena netmanager tak terjangkau) dan `curl -sk https://localhost:8443/` 200.
- [ ] **Step 2:** `kubectl apply --dry-run=client -f deploy/k8s/isolir.yaml` lulus (lokal, tanpa cluster: `--validate=false`).
- [ ] **Step 3:** Commit `build: image, CI, dan manifest k8s`.

---

## Task 9: Rilis dan uji lab (setiap butir menunggu izin pemilik)

Urutan dari spec. Setiap butir: jelaskan apa yang akan dilakukan, tunggu "ya", jalankan, laporkan.

- [ ] 1. Push netmanager `feat/layanan-isolir` ke `main` (deploy via CI); cek route `/api/internal/isolir/page` menjawab 401 tanpa token.
- [ ] 2. Pemilik membuat repo GitHub `netmanager-isolir` (atau mengizinkan `gh repo create`, visibilitas ditentukan pemilik); push; image terbangun.
- [ ] 3. Di radpro: buat token (`openssl rand -hex 32`), set `ISOLIR_SERVICE_TOKEN` di `netmanager-secrets` + `netmanager-isolir-token`, buat Secret TLS, `kubectl apply -f deploy/k8s/isolir.yaml` dengan tag image; restart app agar env terbaca. Dari pod debug di cluster: `curl` NodePort 10.99.0.1:30880 menjawab halaman default. Nilai token tidak pernah dicetak ke log atau chat.
- [ ] 4. Rilis `netmanager-vpn` (core lewat `netmanager-vpn-deploy`, lalu setiap hub); cek `nft list table inet netmanager_vpn` memuat port baru.
- [ ] 5. ROUTERLAB: set mode Server isolir di panel, Reconfigurasi, verifikasi rule di router (`/ip firewall nat`, `/ip firewall mangle`, web proxy mati, guard hilang).
- [ ] 6. Isolir `tes-lab-02` (peringatkan pemilik soal notifikasi "suspended"), dari CHR client lewat mac-telnet: `/tool fetch url=http://example.com/` → HTML tenant; `/tool fetch url=https://example.com/ check-certificate=no` → HTML tenant. Ubah isi Halaman Isolir → tampil ≤ 60 detik tanpa Reconfigurasi.
- [ ] 7. Kembalikan ROUTERLAB ke mode Halaman di router, Reconfigurasi, verifikasi rule mode servis bersih dan web proxy + guard kembali; aktifkan kembali `tes-lab-02`. Hapus file askpass sementara.
