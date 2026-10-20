# Integrasi netmanager ↔ netmanager-vpn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin mengelola server VPN di `/admin/tenants`, admin tenant menambah router RouterOS v7 lewat VPN dari form NAS dengan script siap tempel, dan semua koneksi API/RADIUS router mode VPN berjalan lewat IP tunnel.

**Architecture:** netmanager hanya bicara ke **core** netmanager-vpn lewat HTTP (Bearer `VPN_API_TOKEN`), tidak pernah ke hub. Server VPN di-mirror ke tabel `VpnServer` (id = id hub di core) agar bisa di-assign ke tenant; router VPN menyimpan id router di core (`vpnCoreRouterId`). `MikroTikRouter.ipAddress` = IP tunnel untuk router VPN, sehingga jalur koneksi, NAS sync dan ping-check yang ada tidak berubah.

**Tech Stack:** Next.js 16 / React 19, Prisma (postgres), zod, `node-routeros-v2`, Vitest, Tailwind + komponen `components/ui`. Sisi Go: `github.com/hadiahterlupakan/netmanager-vpn` (satu task kecil).

**Spec:** `docs/superpowers/specs/2026-10-19-vpn-mikrotik-design.md` (disetujui pemilik 2026-10-19). Kontrak API core: `netmanager-vpn/internal/core/api*.go`.

## Global Constraints

- Semua copy UI dan pesan error API berbahasa Indonesia; identifier kode bahasa Inggris (ikuti `CLAUDE.md` netmanager).
- Route = controller tipis (`createHandler`, `apiSuccess`, `apiError`, `ApiErrors` dari `@/lib/api`); logika di `modules/network/services`, Prisma hanya di repository.
- Halaman/route superadmin: `ensureMainTenant()` (halaman) dan `isSuperAdmin(ctx.session?.user)` (API) → `ApiErrors.forbidden()`.
- Migrasi: satu folder `prisma/migrations/20261020090000_add_vpn_servers/` + `schema.prisma` dalam commit yang sama; entri `[MIGRATION]` di `docs/CHANGELOG.md`. Semua kolom baru `MikroTikRouter` nullable atau ber-default.
- Router lama (tanpa toggle) harus berperilaku persis seperti sekarang: default `rosVersion=V6`, `connectionMode=PUBLIC`.
- Tidak ada dependency baru (tidak ada dnd-kit; urutan server pakai tombol naik/turun).
- Env: `VPN_CORE_API_URL` (ConfigMap), `VPN_API_TOKEN` (Secret `netmanager-secrets`), `VPN_CORE_ADDRESS` (ConfigMap, default `10.99.0.1`). Fitur VPN tersembunyi (API → 503 `"Layanan VPN belum dikonfigurasi"`) bila `VPN_CORE_API_URL` kosong.
- Kredensial API router VPN: username `netmanager-<8 hex acak>`, password 32 karakter dari `crypto.randomBytes` (base64url), dibuat di netmanager; tidak pernah dikirim ke core/hub.
- Urutan ganti daftar server (README core): tambah hub baru → perbarui script switch router → baru keluarkan hub lama. Jangan pernah mengganti hub aktif dalam satu `PUT /v1/routers/{id}/hubs`.
- Kerja di worktree `../netmanager-vpn-integration` cabang `feat/vpn-integration`; **jangan push ke `main`** (push = deploy production).
- Gate tiap task: `npm run lint`, `npm run typecheck`, `npm test` hijau.

## Review Focus

1. **Core VPN mati/timeout** saat admin membuka form atau halaman tenant → form mode publik tetap jalan, bagian VPN menampilkan pesan error, tidak ada 500 tak tertangani. (Task 2, 6)
2. **Draft milik tenant lain**: `vpnDraftId` yang dikirim di POST router berasal dari tenant lain atau alamatnya ≠ `ipAddress` → 403/400, tidak di-claim. (Task 5, 7)
3. **Server di-unassign dari tenant** setelah draft dibuat tetapi sebelum router disimpan → simpan ditolak. (Task 7)
4. **Router VPN tak terjangkau saat daftar server diubah** → hub baru tetap ditambahkan, script ditandai `vpnScriptStale=true`, hub lama TIDAK dikeluarkan sampai script terbarui. (Task 9)
5. **Hapus router VPN** ketika core error → router netmanager tetap terhapus dan penghapusan di core dicoba ulang sampai berhasil (router `active` di core tidak kedaluwarsa sendiri). (Task 8)

---

### Task 1: core — `part=switch` di netmanager-vpn

Netmanager perlu badan script switch saja untuk `/system/script/set source=` lewat API RouterOS (spec "Ubah daftar server … tidak perlu tempel ulang").

**Files:**
- Modify: `~/Documents/radpro/netmanager-vpn/internal/core/script.go`
- Test: `~/Documents/radpro/netmanager-vpn/internal/core/api_test.go` (atau file test script yang ada)

**Interfaces:**
- Produces: `GET /v1/routers/{id}/routeros?part=switch` → `text/plain` = `routeros.SwitchSource(in)`.

- [ ] **Step 1:** test `TestRouterScriptSwitchPart`: router dengan dua hub → body sama dengan `routeros.SwitchSource(input)` dan tidak mengandung `/system scheduler`; `part=bogus` → 400.
- [ ] **Step 2:** jalankan `go test ./internal/core/ -run TestRouterScriptSwitchPart` → FAIL.
- [ ] **Step 3:** di `RouterScript` terima `part == "switch"` → `routeros.SwitchSource(in)`; pesan validasi jadi `part must be full, scheduler or switch`.
- [ ] **Step 4:** `go test -race ./...` → PASS.
- [ ] **Step 5:** commit di cabang baru `feat/script-switch-part` repo netmanager-vpn: `feat(core): part=switch untuk memperbarui daftar server lewat API`.

### Task 2: klien core + env

**Files:**
- Create: `modules/network/vpn/VpnCoreClient.ts`, `modules/network/vpn/types.ts`, `modules/network/vpn/index.ts`
- Modify: `.env.production.example`, `k8s/production/configmap.yaml`, `k8s/production/secrets.yaml`, `k8s/production/app-deployment.yaml`, `k8s/production/worker-deployment.yaml`, `k8s/production/cron-deployment.yaml`
- Test: `tests/modules/network/vpn/VpnCoreClient.test.ts`

**Interfaces:**
- Produces (types.ts, field persis JSON core):
  - `CoreHub {id,name,publicHost,listenPort,status:'pending_install'|'online'|'offline'|'expired',routerCount,lastSeenAt:string|null}`
  - `CoreRouter {id,label,ref,address,status:'pending'|'active',hubs:{hubId,name,priority,syncState}[],activeHubId:string|null,lastHandshakeAt:string|null,events:{fromHubId,toHubId,at}[]}`
  - `CoreAdminPeer {id,label,address,publicKey,createdAt}`
- Produces (VpnCoreClient): `class VpnCoreError extends Error {status:number; code:string}`; `isVpnConfigured(): boolean`; `getVpnCoreClient(): VpnCoreClient` dengan method `listHubs()`, `createHub({name,publicHost,listenPort}) → {hub:CoreHub; installCommand:string}`, `reissueHub(id) → {installCommand}`, `hubUpgradeCommand(id) → string`, `deleteHub(id)`, `createRouter({label,hubIds}) → CoreRouter`, `getRouter(id)`, `setRouterHubs(id,hubIds) → CoreRouter`, `claimRouter(id,ref) → CoreRouter`, `deleteRouter(id)`, `routerScript(id, part:'full'|'scheduler'|'switch') → string`, `listAdminPeers()`, `createAdminPeer(label)`, `deleteAdminPeer(id)`, `adminPeerConfig(id) → string`; `getVpnCoreAddress(): string` (default `"10.99.0.1"`).

- [ ] **Step 1:** tests (fetch di-`vi.stubGlobal`): header `Authorization: Bearer <token>`; body error core `{"error":"...","code":"in_use"}` status 409 → `VpnCoreError` status 409 code `in_use`; timeout 5000 ms (AbortController) → `VpnCoreError` status 504 code `timeout`; `routerScript` membaca `text()`; `isVpnConfigured()` false bila `VPN_CORE_API_URL` kosong.
- [ ] **Step 2:** `npx vitest run tests/modules/network/vpn` → FAIL.
- [ ] **Step 3:** implementasi dengan `fetch` + `AbortController` (pola `detectPublicIp`); konstanta `VPN_CORE_TIMEOUT_MS = 5000`. Cek format error core di `netmanager-vpn/internal/core/api.go` (`writeErr`) dan sesuaikan parser.
- [ ] **Step 4:** env: `VPN_CORE_API_URL` + `VPN_CORE_ADDRESS` di configmap, `VPN_API_TOKEN` di secrets (`REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY`) dan `secretKeyRef` di app/worker/cron deployment; contoh di `.env.production.example`.
- [ ] **Step 5:** tests PASS, lint/typecheck; commit `feat(network): klien API core netmanager-vpn`.

### Task 3: skema Prisma

**Files:**
- Modify: `prisma/schema.prisma`, `docs/CHANGELOG.md`, `modules/network/domain/entities/MikroTikRouterEntity.ts`
- Create: `prisma/migrations/20261020090000_add_vpn_servers/migration.sql`

**Interfaces:**
- Produces:
  - `enum RouterOsVersion { V6 V7 }`, `enum RouterConnectionMode { PUBLIC VPN }`
  - `model VpnServer { id String @id /* = id hub core */; name String; publicHost String; listenPort Int; status String @default("pending_install"); lastSeenAt DateTime?; createdAt DateTime @default(now()); tenants TenantVpnServer[]; routers MikroTikRouterVpnServer[] }`
  - `model TenantVpnServer { tenantId String; vpnServerId String; createdAt DateTime @default(now()); @@id([tenantId, vpnServerId]) }` (relasi ke `Tenant` onDelete Cascade, ke `VpnServer` onDelete Restrict)
  - `model MikroTikRouterVpnServer { routerId String; vpnServerId String; priority Int; @@id([routerId, vpnServerId]); @@index([vpnServerId]) }` (router onDelete Cascade, server onDelete Restrict)
  - `model VpnCoreRouterTombstone { coreRouterId String @id; createdAt DateTime @default(now()) }` — router core yang gagal dihapus, dicoba ulang oleh monitor (Task 8).
  - `MikroTikRouter` + `rosVersion RouterOsVersion @default(V6)`, `connectionMode RouterConnectionMode @default(PUBLIC)`, `vpnAddress String?`, `vpnCoreRouterId String? @unique`, `vpnActiveServerId String?`, `publicIpAddress String?`, `vpnScriptStale Boolean @default(false)`, relasi `vpnServers MikroTikRouterVpnServer[]`.
  - Field yang sama ditambahkan ke `MikroTikRouterCreateData`/`MikroTikRouterUpdateData`.

Ruling (catat di CHANGELOG): spec menulis `backhaulAddress`, `wgPublicKey` di `VpnServer` dan `hubPeerId` di `MikroTikRouterVpnServer`. Core menyimpan kunci & alamat sendiri dan memakai **satu** id router untuk semua hub, jadi netmanager tidak menyimpannya; diganti `MikroTikRouter.vpnCoreRouterId`.

- [ ] **Step 1:** ubah schema, `npx prisma migrate dev --name add_vpn_servers --create-only`, ganti nama folder ke `20261020090000_add_vpn_servers`, tambah komentar SQL berbahasa Indonesia.
- [ ] **Step 2:** `npm run prisma:generate && npm run typecheck` → PASS; `npm run test:db` (jalankan `./scripts/setup-test-db.sh` dulu) → migrasi terpasang.
- [ ] **Step 3:** CHANGELOG `[MIGRATION] 20261020090000_add_vpn_servers` + ruling di atas. Commit `feat(db): tabel server VPN dan kolom VPN router`.

### Task 4: superadmin — server VPN, assignment tenant, perangkat admin (API)

**Files:**
- Create: `modules/network/repositories/VpnServerRepository.ts`, `modules/network/services/VpnServerService.ts`
- Create routes: `app/api/admin/vpn-servers/route.ts` (GET, POST), `app/api/admin/vpn-servers/[id]/route.ts` (DELETE), `app/api/admin/vpn-servers/[id]/reissue/route.ts` (POST), `app/api/admin/vpn-servers/[id]/upgrade-command/route.ts` (GET), `app/api/admin/tenants/[id]/vpn-servers/route.ts` (GET, PUT), `app/api/admin/vpn-admin-peers/route.ts` (GET, POST), `app/api/admin/vpn-admin-peers/[id]/route.ts` (DELETE), `app/api/admin/vpn-admin-peers/[id]/config/route.ts` (GET)
- Create: `lib/validations/vpn.ts`
- Test: `tests/modules/network/VpnServerService.test.ts`, `tests/api/admin-vpn-servers-route.test.ts`, `tests/api/admin-tenant-vpn-servers-route.test.ts`

**Interfaces:**
- Produces `VpnServerService`:
  - `listServers(): Promise<VpnServerView[]>` — `listHubs()` dari core, upsert tiap hub ke `VpnServer` (nama/host/port/status/lastSeenAt), kembalikan `VpnServerView = CoreHub & {tenantCount:number}`.
  - `createServer({name, publicHost, listenPort=51821}) → {server: VpnServerView; installCommand}` — core dulu, lalu insert row; gagal insert → `deleteHub` (rollback).
  - `deleteServer(id)` — tolak `VpnServerInUseError(routers:{id,name,tenantName}[])` bila ada baris `MikroTikRouterVpnServer`; core 409 juga dipetakan ke error ini; lalu hapus `TenantVpnServer` dan `VpnServer`.
  - `reissue(id)`, `upgradeCommand(id)` — terusan ke core.
  - `getTenantServerIds(tenantId): string[]`, `setTenantServers(tenantId, ids: string[])` — tolak pencabutan server yang masih dipakai router tenant itu (`VpnServerInUseError`).
  - Admin peers: `listAdminPeers`, `createAdminPeer(label)`, `deleteAdminPeer(id)`, `adminPeerConfig(id)` — terusan ke core.
- zod: `vpnServerCreateSchema {name: 1..64, publicHost: 1..253, listenPort?: 1..65535}`, `tenantVpnServersSchema {serverIds: string[] unik}`, `vpnAdminPeerCreateSchema {label: 1..64}`.
- Peta error: `VpnCoreError` 400 → 400 (pesan core), 404 → `ApiErrors.notFound("Server VPN")`, 409/`VpnServerInUseError` → 409 `{routers}`, timeout/lainnya → 502 `"Server VPN pusat tidak merespons"`; `!isVpnConfigured()` → 503.

- [ ] **Step 1:** tests service (core client & repo di-mock): create rollback saat insert gagal; delete ditolak dengan daftar router; `setTenantServers` menolak mencabut server terpakai; `listServers` meng-upsert status `online`.
- [ ] **Step 2:** tests route: non-superadmin → 403 untuk semua route di atas; body invalid → 400; 503 bila VPN belum dikonfigurasi.
- [ ] **Step 3:** FAIL → implementasi → PASS; commit `feat(network): API superadmin server VPN`.

### Task 5: tenant — daftar server dan draft VPN (API)

**Files:**
- Create: `modules/network/services/VpnDraftService.ts`, `modules/network/services/vpn-api-user-script.ts`
- Create routes: `app/api/vpn-servers/route.ts` (GET), `app/api/mikrotik-routers/vpn-draft/route.ts` (POST), `app/api/mikrotik-routers/vpn-draft/[draftId]/status/route.ts` (GET)
- Test: `tests/modules/network/VpnDraftService.test.ts`, `tests/modules/network/vpn-api-user-script.test.ts`, `tests/api/mikrotik-routers-vpn-draft-route.test.ts`

**Interfaces:**
- `GET /api/vpn-servers` (permission `mikrotik:read`) → `{servers: {id,name,publicHost,status}[]}` hanya server yang di-assign ke tenant pemanggil.
- `POST /api/mikrotik-routers/vpn-draft` (permission `mikrotik:create`), body `{serverIds: string[] (≥1, unik, urutan = prioritas), previousDraftId?: string, apiUsername?: string, apiPassword?: string}` → `{draftId, address, apiUsername, apiPassword, script}`.
  - Validasi semua `serverIds` di-assign ke tenant dan berstatus `online` (selain itu 400 `"Server VPN tidak tersedia untuk tenant ini"`).
  - `previousDraftId` milik tenant ini dan daftar hub sama persis → kembalikan draft yang sama (script dibangun ulang dari core); beda → `deleteRouter(previousDraftId)` lalu buat baru.
  - Kredensial: dipakai dari body bila ada (supaya membuka ulang modal / mengganti server tidak mengganti password yang sudah terisi di form), selain itu dibuat (Global Constraints).
  - Kepemilikan: core router `label = "nm:" + tenantId`. Helper `assertDraftOwned(router: CoreRouter, tenantId): void` (dipakai juga Task 7) melempar `VpnDraftForbiddenError`.
- `GET …/vpn-draft/[draftId]/status` → `{stage: 'waiting'|'tunnel_up', lastHandshakeAt, activeServerId}`; `tunnel_up` bila `lastHandshakeAt` ≤ 180 s lalu (`VPN_HANDSHAKE_FRESH_MS = 180_000`).
- `buildVpnApiUserScript({username, password, coreAddress}): string` — create-or-update, aman ditempel ulang:
  - `/user group` `netmanager-api` policy `read,write,api,test,policy,sensitive`;
  - `/user` `<username>` group `netmanager-api` `address=<coreAddress>/32` password diset ulang;
  - `/ip service set api disabled=no port=8728`, lalu tambahkan `<coreAddress>/32` ke `address` service api **hanya bila** `address` tidak kosong dan belum memuatnya (kosong = sudah terbuka untuk semua; jangan dipersempit).
  - Script akhir = `routerScript(id,'full')` + `"\n"` + `buildVpnApiUserScript(...)`.

- [ ] **Step 1:** test `buildVpnApiUserScript`: berisi `address=10.99.0.1/32`, tidak berisi `remove`, password di-quote dengan escape `"`, `\`, `$`; snapshot ke `tests/modules/network/__snapshots__` ditandai sementara sampai spike (konstruksi `:find` pada array address ditandai UNSURE seperti R7 core).
- [ ] **Step 2:** test service: server tenant lain → 400; draft tenant lain → 403; daftar sama → `createRouter` tidak dipanggil; daftar beda → `deleteRouter(previous)` lalu `createRouter`.
- [ ] **Step 3:** test route: tanpa `mikrotik:create` → 403; status `tunnel_up` vs `waiting` dengan waktu tetap.
- [ ] **Step 4:** FAIL → implementasi → PASS; commit `feat(network): draft router VPN dan script API user`.

### Task 6: tab "Server VPN" dan checklist tenant (UI superadmin)

**Files:**
- Modify: `app/admin/tenants/TenantsClient.tsx` (tab ketiga `'vpn'` berlabel "Server VPN"), `app/admin/tenants/TenantList.tsx` (link baris "Server VPN" → `/admin/tenants/${id}/vpn`)
- Create: `app/admin/tenants/vpn/VpnServerPanel.tsx`, `app/admin/tenants/vpn/AddVpnServerModal.tsx`, `app/admin/tenants/vpn/VpnAdminPeerSection.tsx`, `app/admin/tenants/[id]/vpn/page.tsx`, `app/admin/tenants/[id]/vpn/TenantVpnClient.tsx`
- Test: `tests/app/admin-vpn-server-panel.test.tsx` (pola harness jsdom presurvei)

**Isi:**
- Panel: tabel (`ResponsiveTable`) nama, host:port, status (badge: Menunggu instal / Online / Offline / Kedaluwarsa), jumlah router, handshake terakhir; tombol "Tambah Server VPN", "Perintah upgrade", "Buat ulang perintah instal" (hanya `pending_install`/`expired`), "Hapus" (409 → tampilkan daftar router yang harus dipindah).
- Modal tambah: nama, IP/hostname publik, port (default 51821) → tampilkan perintah instal dengan tombol salin (`navigator.clipboard.writeText` + `toast.success("Perintah disalin")`), teks "Jalankan sebagai root di VPS. Perintah berlaku 1 jam.", polling `GET /api/admin/vpn-servers` tiap 5 s sampai status `online` lalu tampilkan "Server tersambung".
- Perangkat admin: daftar, tambah (label) → tampilkan config wg-quick untuk diunduh/salin, hapus.
- `[id]/vpn`: `ensureMainTenant()`; checklist server, simpan → `PUT /api/admin/tenants/[id]/vpn-servers`, pola `TenantFeaturesClient` (`pendingChanges`).
- Error 503 → kartu "Layanan VPN belum dikonfigurasi".

- [ ] **Step 1:** test panel: render daftar dari fetch mock; klik Hapus dengan respons 409 menampilkan nama router; 503 menampilkan kartu.
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(tenants): tab Server VPN`.

### Task 7: buat router via VPN (service + API)

**Files:**
- Modify: `lib/validations/mikrotik.ts`, `app/api/mikrotik-routers/route.ts`, `modules/network/services/mikrotik-router.mutations.ts`, `modules/network/services/mikrotik-router.provisioning.ts`, `modules/network/services/MikroTikProvisioningService.ts`, `modules/network/services/mikrotik-provisioning.radius.ts`, `modules/network/repositories/MikroTikRouterRepository.ts`, `modules/network/services/RouterReconfigureRouteService.ts`
- Test: `tests/modules/network/mikrotik-router-vpn-create.test.ts`, `tests/modules/network/mikrotik-provisioning-radius-src.test.ts`, perluas `tests/api/mikrotik-routers-route.test.ts` (atau buat bila belum ada)

**Interfaces:**
- `mikrotikRouterCreateSchema` + `rosVersion?: 'V6'|'V7'`, `connectionMode?: 'PUBLIC'|'VPN'`, `vpnServerIds?: string[]`, `vpnDraftId?: string`; `superRefine`: `VPN` wajib `rosVersion='V7'`, `vpnServerIds` ≥1, `vpnDraftId` ada.
- Create mode VPN (di `createRouter`, sebelum insert): `getRouter(vpnDraftId)` → `assertDraftOwned`; `router.address === ipAddress` (selain itu 400 `"IP Router tidak cocok dengan draft VPN"`); hub di draft == `vpnServerIds` berurutan; semua server masih di-assign ke tenant. Insert router (`connectionMode=VPN`, `vpnAddress=ipAddress`, `vpnCoreRouterId`) + baris `MikroTikRouterVpnServer` (priority 0..n-1) dalam satu transaksi, lalu `claimRouter(vpnDraftId, router.id)`; claim gagal → hapus router yang baru dibuat dan kembalikan 502.
- `provisionRadius(..., srcAddress?: string | null)` parameter terakhir → `=src-address=<ip>` pada `/radius/add` dan `/radius/set`.
- `createRadiusProvisioningArgs` dan `RouterReconfigureRouteService`: router `VPN` → `radiusServerIp = getVpnCoreAddress()`, `srcAddress = ipAddress`; router `PUBLIC` tetap `null` (perilaku lama).
- Router VPN: lewati `persistGeneratedApiUser` (kredensial sudah dibuat script VPN). Ruling.

- [ ] **Step 1:** tests: draft tenant lain → 403; alamat beda → 400; server tak di-assign → 400; claim gagal → router dihapus; router PUBLIC tanpa field baru → payload repo sama seperti sebelum perubahan; provisioning VPN memanggil `/radius/add` dengan `=address=10.99.0.1` dan `=src-address=<ip>`.
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(network): simpan router mode VPN dan RADIUS lewat tunnel`.

### Task 8: hapus router VPN

**Files:**
- Modify: `modules/network/services/mikrotik-router.mutations.ts`
- Test: `tests/modules/network/mikrotik-router-vpn-delete.test.ts`

- [ ] **Step 1:** test: hapus router VPN memanggil `deleteRouter(vpnCoreRouterId)` setelah deprovision; core error → router netmanager tetap terhapus, error di-log dengan id core.
- [ ] **Step 2:** test: core error → baris `VpnCoreRouterTombstone` dibuat; `retryVpnCoreRouterDeletes()` (dipanggil `MikroTikMonitor` tiap siklus) menghapus baris saat core sukses atau 404, dan membiarkannya saat core error lain.
- [ ] **Step 3:** FAIL → implementasi → PASS; commit `feat(network): hapus router VPN di core dengan retry`.

### Task 9: daftar server, server pertama, status di halaman edit

**Files:**
- Create: `modules/network/services/VpnRouterService.ts`, `modules/network/services/mikrotik-vpn-routeros.ts`, routes `app/api/mikrotik-routers/[id]/vpn/route.ts` (GET detail, PUT `{serverIds}`), `app/api/mikrotik-routers/[id]/vpn/first-server/route.ts` (POST)
- Modify: `modules/network/services/MikroTikMonitor.ts` (retry `vpnScriptStale`), `modules/network/services/mikrotik-ping-check.ts`
- Test: `tests/modules/network/VpnRouterService.test.ts`, `tests/modules/network/mikrotik-ping-check-vpn.test.ts`

**Interfaces:**
- `mikrotik-vpn-routeros.ts`: `setSwitchScript(conn, source: string)` → `/system/script/print ?name=netmanager-vpn-switch` lalu `/system/script/set =.id=… =source=…`; `setPeerEndpoint(conn, {host, port, publicKey})` → `/interface/wireguard/peers/print ?interface=netmanager-vpn` lalu `set` `endpoint-address`, `endpoint-port`, `public-key`.
- `VpnRouterService.updateServers(routerId, tenantId, serverIds)`:
  1. validasi assignment & online;
  2. `setRouterHubs(core, [...baru, ...lamaYangDikeluarkan])` — hub lama yang dikeluarkan ditaruh di ekor (prioritas terakhir), jadi hub aktif tidak pernah hilang dalam satu PUT;
  3. `routerScript(core,'switch')` (memuat ekor itu; router hanya pindah ke sana bila semua server baru gagal) lalu `setSwitchScript` lewat API RouterOS;
  4. sukses → `setRouterHubs(daftar baru)` + perbarui `MikroTikRouterVpnServer`, `vpnScriptStale=false`; gagal menulis ke router → `vpnScriptStale=true`, hub lama tetap di ekor, monitor mengulang langkah 3–4 saat router online.
- `returnToFirstServer(routerId, tenantId)` → `setPeerEndpoint` ke server prioritas 0.
- `getRouterVpn(routerId, tenantId)` → `{servers:[{id,name,priority}], activeServerId, isOnBackup, lastHandshakeAt, events, scriptStale}`; `isOnBackup = activeServerId !== servers[0].id`.
- Ping-check: router VPN yang gagal API dan core `lastHandshakeAt` > 180 s → `pingStatus = "tunnel_down"`; sukses → simpan `vpnActiveServerId` dari core. Core error → perilaku lama (`offline`).

- [ ] **Step 1:** tests: urutan panggilan core (`setRouterHubs` union → `routerScript switch` → RouterOS `set` → `setRouterHubs` final); router tak terjangkau → `vpnScriptStale=true` dan `setRouterHubs` final tidak dipanggil; ping-check `tunnel_down`.
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(network): kelola daftar server VPN router tanpa tempel ulang`.

### Task 10: form NAS — toggle, daftar server, modal script VPN (UI)

**Files:**
- Modify: `app/admin/network/mikrotik/new/MikrotikNewClient.tsx`, `app/admin/network/mikrotik/components/mikrotikRouterForm.tsx`, `app/admin/network/mikrotik/mikrotikFormShared.ts`
- Create: `app/admin/network/mikrotik/components/VpnConnectionSection.tsx`, `components/mikrotik/VpnScriptModal.tsx`, `hooks/useVpnDraftStatus.ts`
- Test: `tests/app/mikrotik-new-vpn.test.tsx`

**Isi:**
- `MikrotikRouterFormData` + `rosVersion`, `connectionMode`, `vpnServerIds`, `vpnDraftId`. Toggle "RouterOS v7" (default mati); bila nyala, toggle "Pakai VPN"; bila VPN nyala, daftar server dari `GET /api/vpn-servers` (default semua yang online, centang + tombol naik/turun, minimal satu). Toggle memakai pola checkbox `peer sr-only` dari `NetworkSettings.tsx`.
- `</> SCRIPT GENERATOR`: mode VPN → `VpnScriptModal`; selain itu modal lama tanpa perubahan.
- Modal VPN: `POST vpn-draft` saat dibuka (kirim `previousDraftId` + kredensial yang sudah ada), tampilkan script + tombol salin, isi form: `ipAddress=address`, `apiPort=8728`, `apiUsername`, `apiPassword`, `vpnDraftId`. Field itu `readOnly` dengan tombol tampil/salin password. Ganti centang/urutan server membuat draft baru saat modal dibuka lagi.
- Status: polling `GET vpn-draft/[id]/status` tiap 5 s: "Menunggu script ditempel" → "Tunnel tersambung" → jalankan `runTest()` otomatis → "API tersambung" / gagal. Versi dari `routerInfo.version` < 7 → gagal dengan pesan "RouterOS harus versi 7". 2 menit tanpa handshake → petunjuk "Pastikan RouterOS v7 dan VPS bisa dijangkau dari router."
- Submit tetap lewat tombol "Tambahkan Router".
- VPN 503/error → toggle "Pakai VPN" nonaktif dengan keterangan.

- [ ] **Step 1:** test: toggle v7 mati → tidak ada toggle VPN dan modal lama dipakai; mode VPN + respons draft → field IP/port/user/password terisi dan readOnly; status `tunnel_up` memicu fetch `test-connection` sekali; versi `6.49` → pesan gagal.
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(mikrotik): mode VPN di form tambah router`.

### Task 11: halaman edit — VPN router (UI) dan status daftar

**Files:**
- Modify: `app/admin/network/mikrotik/[id]/edit/MikrotikEditClient.tsx`, `app/admin/network/mikrotik/components/mikrotikRouterTable.tsx`
- Create: `app/admin/network/mikrotik/[id]/edit/RouterVpnPanel.tsx`
- Test: `tests/app/mikrotik-router-vpn-panel.test.tsx`

**Isi:**
- Router VPN: panel daftar server (ubah/urut, simpan → `PUT …/vpn`), server aktif, badge "Berjalan di server cadangan", riwayat perpindahan (`events`), peringatan "Daftar server belum terkirim ke router" bila `scriptStale`, tombol "Kembalikan ke server pertama", dan panduan teks (tidak dijalankan) `/ip service set api,winbox,ssh address=...`. IP Router/Port/Username/Password `readOnly`.
- Tabel daftar: status `tunnel_down` → titik oranye "Tunnel putus".

- [ ] **Step 1:** test panel: `isOnBackup` menampilkan badge; klik "Kembalikan ke server pertama" mem-POST endpoint; tabel menampilkan "Tunnel putus".
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(mikrotik): panel VPN di halaman edit router`.

### Task 12: router lama ⇄ VPN

**Files:**
- Create: routes `app/api/mikrotik-routers/[id]/vpn/enable/route.ts` (POST → draft untuk router ini), `app/api/mikrotik-routers/[id]/vpn/migrate/route.ts` (POST pindahkan ke VPN), `app/api/mikrotik-routers/[id]/vpn/revert/route.ts` (POST kembali ke publik)
- Modify: `modules/network/services/VpnRouterService.ts`, `app/admin/network/mikrotik/[id]/edit/RouterVpnPanel.tsx`
- Test: `tests/modules/network/VpnRouterService.migrate.test.ts`

**Interfaces:**
- `enable`: hanya `rosVersion=V7` & `PUBLIC`; draft seperti Task 5 tetapi script bagian API user memakai **kredensial lama** router (tidak membuat user baru, hanya menambah `10.99.0.1/32` ke address user & service).
- `migrate`: syarat draft `tunnel_up` dan test API lewat IP tunnel sukses. Transaksi: `publicIpAddress = ipAddress`, `ipAddress = vpnAddress`, `connectionMode=VPN`, sync NAS (nasname ikut), `claimRouter`; lalu provision ulang RADIUS lewat tunnel. Provisioning gagal → kembalikan semua kolom dan nasname, draft core tetap (admin boleh coba lagi), kembalikan 502.
- `revert`: kebalikan (provision RADIUS ke `detectPublicIp()` tanpa src-address dulu, lewat tunnel, baru ganti `ipAddress` ke `publicIpAddress`), lalu `deleteRouter` core.
- Rekonsiliasi `rosVersion`: test koneksi yang mengembalikan versi ≥7 boleh mengubah toggle v7 di form edit.

- [ ] **Step 1:** tests: migrate memindahkan ip & nasname; provisioning gagal → semua kolom kembali; revert urutannya provisioning dulu baru ganti IP.
- [ ] **Step 2:** FAIL → implementasi → PASS; commit `feat(network): pindahkan router lama ke VPN dan kembali`.

### Task 13: dokumen dan verifikasi akhir

**Files:**
- Modify: `docs/deployment/netmanager-vpn.md` (env netmanager, urutan rollout: deploy core → set Secret → deploy netmanager), `docs/CHANGELOG.md` (`[Unreleased]` fitur VPN)

- [ ] **Step 1:** `npm run check` → PASS.
- [ ] **Step 2:** commit `docs: integrasi VPN netmanager`.

Uji end-to-end (router sungguhan, dua hub) mengikuti spike plan `2026-10-19-vpn-spike.md` dan bukan bagian plan ini.
