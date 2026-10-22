# VPN integration follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four items left open after plan 2026-10-20 on branch `feat/vpn-integration`: router addresses must be IPs, serialized server-list sends, the test-connection result bug, and the three spec features that were never scheduled.

**Architecture:** All work stays in the netmanager worktree on `feat/vpn-integration`; no core (netmanager-vpn) change. Server-list fan-out (add to all routers, remove from all routers) only rewrites the local list and marks it stale; the existing monitor retry (`retryStaleVpnScripts`) delivers it, so routers that are offline are retried when they come back.

**Tech Stack:** Next.js route handlers, Prisma/Postgres, vitest (+ `npm run test:db` against Postgres), node-routeros-v2.

**Spec:** `docs/superpowers/specs/2026-10-19-vpn-mikrotik-design.md` — sections "Ubah daftar server", "Server baru di-assign ke tenant", "Status dan alamat RADIUS" (backup badge, "keluarkan dari semua router").

## Global Constraints

- Read `CLAUDE.md` and `.superpowers/sdd/2026-10-20-netmanager-vpn-integration/netmanager-context.md` before coding (env vars for tests, conventions, layering: thin routes → services → repositories; Prisma only in repositories).
- Indonesian for all UI copy and error messages.
- Conventional Commits; every commit ends with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push, never switch branches, never touch `/Users/rohadimraja/Documents/radpro/netmanager`.
- Gate before each commit: `npm run lint`, `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`, focused vitest files; full `npx vitest run --maxWorkers=50%` at the end of each task.
- API passwords never logged and never sent to core.
- Every bug fix gets a test that fails before the fix.

## Review Focus

1. A legacy PUBLIC router stored with a hostname must still load, monitor and save when its address is not changed.
2. Two concurrent server-list changes on one router (PUT + monitor retry, PUT + PUT) must never leave the router's switch script built from a different list than core's final list while `vpnScriptStale` is false.
3. "Add to all routers" on a router that already has the server is a no-op, not a duplicate row.
4. "Remove from all routers" never empties a router's list; routers whose only server it is are reported, not changed.
5. A failed test connection (HTTP 4xx/5xx or `api.success=false`) never enables "Simpan" in public mode and shows "Koneksi Gagal".

---

### Task 1: test-connection result is read from the payload

**Files:** Modify `app/admin/network/mikrotik/mikrotikFormShared.ts` (`submitMikrotikConnectionTest`, `evaluateVpnConnectionTest`, delete `unwrapTestConnectionResult`), `app/admin/network/mikrotik/new/MikrotikNewClient.tsx` (drop the now-wrong comment at `handleTestConnection`). Tests next to the existing ones for these files.

Bug: the route answers `apiSuccess({...})` = `{success: true, data: {success, api, routerInfo, message}}`; the client returns the envelope, so `result.success` is always true (public "Simpan" unlocks on a failed test, the modal shows "Koneksi Berhasil", `result.api` is undefined).

- [ ] Failing tests for `submitMikrotikConnectionTest` (fetch stubbed):
  - 200 `{success:true,data:{success:false,api:{success:false,message:"x"},message:"Koneksi gagal..."}}` → returns `success:false`, `api.message === "x"`.
  - 200 with `data.success:true` and `routerInfo.version:"7.16"` → `success:true`, `routerInfo.version === "7.16"`.
  - 400 `{success:false,error:"Alamat ini khusus jaringan VPN"}` → `success:false`, `message` and `api.message` equal that error.
  - Non-JSON / network error keeps today's fallback.
- [ ] `useMikrotikConnectionTest.runTest()` returns false for the 200/`data.success:false` case (hook test).
- [ ] Implement: unwrap `data` once in `submitMikrotikConnectionTest`; map non-OK to a failed result carrying the route's `error`/`message`; `evaluateVpnConnectionTest` takes the unwrapped result (remove its own unwrap). Update existing tests that fed the envelope to `evaluateVpnConnectionTest`.
- [ ] Commit `fix(mikrotik): hasil test koneksi dibaca dari isi respons, bukan amplop`.

### Task 2: router addresses must be literal IPs

**Files:** Modify `modules/network/services/vpn-overlay-target.ts`, `modules/network/services/vpn-migration.preconditions.ts` (or wherever migrate PUBLIC→VPN checks the router), tests under `tests/` beside existing `vpn-overlay-target` / migration tests; `docs/CHANGELOG.md` entry later in Task 7.

Owner decision (2026-10-23): forbid hostnames for router `ipAddress` instead of re-checking DNS on every connection path.

- [ ] `assertNotVpnOverlayTarget(host)` becomes IP-only: literal IPv4/IPv6 → normalised and overlay-checked as today; anything that is not a literal IP → `VpnRouterInvalidError(ROUTER_ADDRESS_NOT_IP_MESSAGE)` with `ROUTER_ADDRESS_NOT_IP_MESSAGE = "IP Router harus berupa alamat IP, bukan nama host"`; an IPv6 literal with a zone id (`fe80::1%eth0`) or any literal `new URL` cannot parse → `INVALID_ROUTER_ADDRESS_MESSAGE` (400, never 500). Remove the DNS lookup code and `UNVERIFIABLE_ROUTER_ADDRESS_MESSAGE` and their tests; nothing may still import them.
- [ ] Entry points stay as they are and now inherit the rule: create PUBLIC (`saveCreatedRouter`), PATCH PUBLIC only when `ipAddress` changes (`guardRouterUpdate` — an unchanged legacy hostname still saves), test-connection (`resolveTestAddress`), revert (`publicIpAddress`).
- [ ] Migrate PUBLIC→VPN: reject with 400 `"Ganti IP Router dengan alamat IP sebelum pindah ke VPN"` when the router's current `ipAddress` is not a literal IP, before any RouterOS or core call, so `publicIpAddress` is always an IP and revert can never be blocked by a hostname.
- [ ] Tests: hostname rejected on create/test-connection/changed PATCH (400 message); unchanged hostname PATCH passes; zone-id → 400; migrate with hostname → 400 and no core/RouterOS call; existing overlay tests (decimal/octal/hex/mapped IPv6) still pass.
- [ ] Commit `fix(network): IP router wajib alamat IP, nama host ditolak`.

### Task 3: one server-list send per router at a time

**Files:** `modules/network/domain/ports/IMikroTikRouterVpnRepository.ts`, `modules/network/repositories/MikroTikRouterVpnRepository.ts`, `modules/network/services/VpnRouterService.ts`, `modules/network/vpn/errors.ts` (message param on `VpnRouterBusyError`), tests in `tests/` + `tests/db/vpn-integration.test.ts`.

Residual I5: CAS in `completeScriptSend` does not stop a retry and a PUT from interleaving `keepRemovedHubsAtTail` → render → write, so the router can get a script rendered from the other request's list while stale is cleared.

- [ ] Repository: `withServerListLock<T>(routerId: string, fn: () => Promise<T>): Promise<{ acquired: true; value: T } | { acquired: false }>` — an interactive `$transaction` that runs `SELECT pg_try_advisory_xact_lock(hashtextextended('vpn-server-list:' || $1, 0))` and, if acquired, awaits `fn()` inside it (fn uses its own queries/connections; the lock is released when the transaction ends). Transaction `timeout` = `SERVER_LIST_LOCK_TX_TIMEOUT_MS` = 60_000 with a comment summing the bounded steps (core GET+PUT, script GET, RouterOS write, `completeScriptSend`); `maxWait` default.
- [ ] `updateServers`: after `assertServersOnline`, run `keepRemovedHubsAtTail` → `replaceServersAsStale` → `sendSwitchScript` inside the lock; not acquired → throw `VpnRouterBusyError("Daftar server router ini sedang diperbarui, coba lagi sebentar")` (409) and write nothing.
- [ ] `retryStaleScript`: same lock; not acquired → return false (stays stale, next cycle). Reads the local list inside the lock.
- [ ] `completeScriptSend` CAS stays (bulk edits in Tasks 4–5 do not take the lock).
- [ ] Unit tests with a fake repo: lock not acquired → PUT 409 and no core/RouterOS/DB write; retry returns false with no calls. DB test (`tests/db`): two concurrent `withServerListLock` on the same router → exactly one `acquired:true`; different routers → both acquired; lock released after fn throws.
- [ ] Commit `fix(network): kirim daftar server router VPN satu per satu`.

### Task 4: add a server to all VPN routers of a tenant

**Files:** `IMikroTikRouterVpnRepository` + `MikroTikRouterVpnRepository` (or `VpnServerRepository` if it fits better — pick one, keep Prisma there), `VpnServerService` (or `VpnRouterService`), new route `app/api/admin/tenants/[id]/vpn-servers/[serverId]/routers/route.ts` (POST, superadmin via `vpnAdminGuard`, ids via `vpnIdSchema`), `modules/network/index.ts` export, UI in `app/admin/tenants/[id]/vpn/TenantVpnClient.tsx`, tests.

- [ ] Repository `appendServerToTenantRouters(tenantId, serverId): Promise<number>` in one transaction: for each router with `tenantId`, `connectionMode "VPN"`, `vpnCoreRouterId` not null and no row for `serverId` — lock the router row first (`updateMany … vpnScriptStale: true`, same pattern as `completeScriptSend`), then insert at `priority = max+1`; returns the number of routers changed. Routers that already have it are untouched (no duplicate, stale flag unchanged).
- [ ] Service: server must be assigned to the tenant and online (`assertServersOnline`) else existing 400; returns `{ updated: number }`. Delivery is the monitor retry; no RouterOS call here.
- [ ] Route returns `apiSuccess({ updated })`; errors through `vpnErrorResponse`.
- [ ] UI: on each assigned, online server row in the tenant VPN page a button "Tambahkan ke semua router VPN" with a confirm modal (components/ui Modal; not `window.confirm`) stating routers get it as the last backup and offline routers receive it when they reconnect; toast `"Ditambahkan ke N router. Router menerima daftar baru dalam beberapa menit."`; N=0 → `"Semua router VPN tenant sudah memakai server ini"`.
- [ ] Tests: repo DB test (append, idempotent second call returns 0, PUBLIC router untouched, other tenant untouched, priority = max+1); service (not assigned/offline → error, no write); route (non-superadmin 403, bad id 400); UI (button calls the route, toast text).
- [ ] Commit `feat(network): tambahkan server VPN ke semua router tenant`.

### Task 5: remove a server from all routers before deleting it

**Files:** repository (same place as Task 4), `VpnServerService`, new route `app/api/admin/vpn-servers/[id]/routers/route.ts` (DELETE, superadmin), `app/admin/tenants/vpn/DeleteVpnServerModal.tsx`, tests.

- [ ] Repository `detachServerFromRouters(serverId): Promise<{ detached: number; onlyServer: VpnServerRouterUsage[] }>` across tenants, one transaction: per router using it — if it is the router's only server, skip and report (id, name, tenantName); else lock the row (`vpnScriptStale: true`), delete the link, renumber remaining priorities 0..n-1 in their existing order.
- [ ] Service `detachServer(id)` returns that result. `deleteServer` is unchanged: it stays blocked while local links exist, and while core still lists the hub on a router (core 409 → `VpnServerInUseError([])`); map that empty-list case in the modal to `"Server masih tercatat di router yang belum menerima daftar baru. Coba hapus lagi setelah beberapa menit."`.
- [ ] Modal: when delete returns in-use routers, show a button "Keluarkan dari semua router" (confirm) → DELETE route → show `"Dikeluarkan dari N router."` plus the list of routers it is the only server for (`"Router berikut hanya memakai server ini; tambahkan server lain dulu:"`). Then the user retries "Hapus".
- [ ] Tests: repo DB test (two routers in two tenants, one has only this server → detached 1, onlyServer 1, priorities renumbered, stale true); route 403/400; modal flow (in-use → button → result text).
- [ ] Commit `feat(network): keluarkan server VPN dari semua router`.

### Task 6: "Server cadangan" badge in the router list

**Files:** `modules/network/services/mikrotik-ping-check.ts`, `mikrotik-ping-check.vpn.ts`, router list repository/selectors + `MikrotikRouterListItem`, `app/admin/network/mikrotik/components/mikrotikRouterTable.tsx`, tests.

`vpnActiveServerId` is only refreshed when someone opens the edit page, so a list badge would be stale.

- [ ] Monitor: for every VPN router with `vpnCoreRouterId` (online or not), one `getRouter` per cycle through the existing `CoreLookupBreaker`; result gives both the failed status (`tunnel_down`/`offline`, unchanged rule) and `activeHubId`, saved to `vpnActiveServerId` in the same `update` as `pingStatus`. Breaker tripped / core error / VPN unconfigured → `vpnActiveServerId` not written (undefined), status rule as today.
- [ ] List item gains `vpnOnBackup: boolean` = VPN router, `vpnActiveServerId` set, and it differs from the router's priority-0 server (select the first server in the list query; no N+1).
- [ ] Table: when `pingStatus === "online"` and `vpnOnBackup`, show a second badge "Server cadangan" (amber tone, dark-mode classes like `STATUS_TONES`) with `title="Router berjalan di server VPN cadangan"`.
- [ ] Tests: ping-check (online VPN router → activeServerId saved; breaker tripped → not written; public router → no core call); list mapping (first server vs active); table renders badge only for online + backup.
- [ ] Commit `feat(mikrotik): tanda server cadangan di daftar router`.

### Task 7: docs and verification

- [ ] `docs/CHANGELOG.md`: entries for Tasks 1–6 under the existing VPN entry; note for owner: before deploy, list PUBLIC routers whose `ipAddress` is not an IP (SQL in `docs/deployment/netmanager-vpn.md`) — they keep working but must get an IP before their address is edited or they move to VPN.
- [ ] `docs/deployment/netmanager-vpn.md`: that SQL query; the add/remove-all-routers flow (delivery by the 5-minute monitor, 20 routers per tenant per cycle).
- [ ] Full gate + `npm run test:db` against a scratch Postgres (Docker, as in plan 2026-10-20 I6).
- [ ] Commit `docs: tindak lanjut integrasi VPN`.
