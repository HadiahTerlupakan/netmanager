# accel-ppp Server Coexist with MikroTik (Pure RADIUS-driven)

**Date:** 2026-05-23
**Status:** Draft (awaiting user review)
**Author:** agent
**Related modules:** `modules/network`, `modules/settings`

---

## 1. Problem & Goal

Saat ini netmanager mendukung MikroTik sebagai PPPoE server, dengan FreeRADIUS sebagai
backend auth/accounting. Ada kebutuhan untuk menambahkan **accel-ppp on Linux** sebagai
PPPoE server alternatif yang berdiri **bersama (coexist)** MikroTik existing—bukan
menggantikan.

### Goal MVP
1. CRUD `AccelPppServer` (registrasi server accel-ppp ke aplikasi) + UI admin.
2. End-to-end auth: pelanggan bisa login PPPoE di accel-ppp via FreeRADIUS.
3. Bundle config FreeRADIUS (per-NAS attribute routing) siap apply.
4. Dashboard monitoring accel-ppp (status server, live sessions, kick).

### Non-goals (out of scope)
- Migrasi MikroTik existing ke pure-RADIUS auth (di-defer ke project terpisah).
- Failover/load balancing otomatis antar PPPoE server.
- Protokol tunneling selain PPPoE (L2TP, SSTP, PPTP).
- Refactor/reorganisasi service MikroTik existing.

---

## 2. Key Decisions

| Aspek | Keputusan | Alasan |
|---|---|---|
| Pendekatan arsitektur | **B — Coexist tanpa abstraksi**: service accel-ppp paralel, MikroTik tidak disentuh | User explicit choice. Mengurangi risk break MikroTik flow yang sudah produksi. |
| Server target | accel-ppp on Linux | User explicit choice. Open-source, scalable, ISP-grade. |
| Control method | Pure RADIUS-driven untuk provisioning user + CLI socket TCP 2001 untuk live ops (monitor, kick) | Provisioning generic via RADIUS; live ops butuh real-time, RADIUS accounting punya delay. |
| Topologi pelanggan | Any-server (pelanggan tidak terikat ke server tertentu) | RADIUS auth based on username, bukan NAS-IP. NAS aktif ditrack via `radacct.nasipaddress`. |
| Toggle aktivasi | Setting global system-wide `fullRadiusMode` | Sederhana, satu saklar untuk seluruh sistem. |
| Guard saat OFF | API-level reject (403 dari middleware) | Server-side enforcement, frontend tidak bisa bypass. |
| Bandwidth delivery via RADIUS | Per-NAS routing di FreeRADIUS (huntgroup + unlang policy) | radreply tidak penuh attribute redundant; logic NAS-aware terpusat di RADIUS. |
| MikroTik existing | Zero perubahan | Mode hybrid current (local secret + RADIUS) tetap jalan. |
| Module placement | `modules/network/` (namespace accel-ppp/ untuk file baru) | Konsisten dengan pattern existing; satu module = satu domain. |

---

## 3. Architecture

### 3.1 Module structure

```
modules/network/
├── domain/
│   ├── entities/
│   │   └── AccelPppServerEntity.ts          [NEW]
│   ├── ports/
│   │   └── IAccelPppServerRepository.ts     [NEW]
│   └── errors/
│       └── AccelPppErrors.ts                [NEW]
├── repositories/
│   └── AccelPppServerRepository.ts          [NEW]
├── services/
│   ├── AccelPppServerService.ts             [NEW]
│   ├── AccelPppMonitor.ts                   [NEW]
│   └── AccelPppCliClient.ts                 [NEW]
├── validators/
│   └── accelPppServer.ts                    [NEW]
└── index.ts                                  [UPDATE: export public API]

modules/settings/
└── (existing) tambah field fullRadiusMode di settings network

app/admin/network/accel-ppp/                  [NEW]
├── page.tsx                                   list + status
├── new/page.tsx                               create form
└── [id]/page.tsx                              detail/edit + sessions tab

app/api/accel-ppp-servers/                    [NEW]
├── route.ts                                   GET, POST
├── [id]/route.ts                              GET, PATCH, DELETE
├── [id]/test-connection/route.ts             POST
├── [id]/sessions/route.ts                    GET (live)
└── [id]/sessions/[username]/kick/route.ts    POST

freeradius-config/                            [NEW versioned bundle]
├── README.md
├── huntgroups
├── policy.d/per-nas-routing
└── sites-available/default.snippet

prisma/migrations/
└── YYYYMMDD_add_accel_ppp_server/migration.sql

docs/guides/
└── accel-ppp-setup.md                       [NEW]
```

### 3.2 Module boundary

- accel-ppp services: zero dependency ke MikroTik services.
- MikroTik services: zero dependency ke accel-ppp services.
- Shared: `RadiusRepository` & FreeRADIUS DB (by-design shared antar PPPoE server).
- Shared: `modules/settings` untuk read `fullRadiusMode`.

### 3.3 Full RADIUS Mode guard

Util baru `requireFullRadiusMode()` di `lib/` (atau `modules/settings`). Dipanggil
sebagai guard pertama di setiap route handler `app/api/accel-ppp-servers/*`. Jika
setting OFF → throw `FullRadiusModeDisabledError` → mapped ke 403.

---

## 4. Data Model

### 4.1 Prisma — model baru

```prisma
model AccelPppServer {
  id              String   @id @default(cuid())
  name            String
  ipAddress       String
  description     String?

  // RADIUS coordination
  nasIdentifier   String?
  radiusSecret    String
  authPort        Int      @default(1812)
  acctPort        Int      @default(1813)
  coaPort         Int      @default(3799)

  // accel-ppp CLI socket
  cliHost         String
  cliPort         Int      @default(2001)
  cliPassword     String?

  // Health & status
  pingStatus      String   @default("offline")
  userOnline      Int      @default(0)
  lastStatusCheck DateTime?

  // Multi-tenant & site
  siteId          String?
  tenantId        String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  site            Sites?  @relation(fields: [siteId], references: [id])
  tenant          Tenant? @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([pingStatus])
  @@index([siteId])
  @@index([tenantId])
  @@unique([ipAddress, tenantId])
}
```

Catatan implementasi:
- `radiusSecret` & `cliPassword` di-encrypt at rest mengikuti pattern `apiPassword`
  pada `MikroTikRouter` (cek helper encryption existing saat implementasi).
- `nasIdentifier` opsional: default = `ipAddress` jika kosong saat lookup.
- Unique constraint `(ipAddress, tenantId)`: cegah duplicate IP per tenant.

### 4.2 Settings — field baru

Tambah ke settings network (lokasi tepat dicek di `modules/settings` saat implementasi):

```typescript
{
  fullRadiusMode: boolean;          // default: false
  fullRadiusModeUpdatedAt: Date;
  fullRadiusModeUpdatedBy: string;  // userId, untuk audit
}
```

### 4.3 FreeRADIUS DB — tidak ada perubahan schema

- `radcheck`, `radreply`, `radusergroup` — sama dipakai untuk MikroTik & accel-ppp.
- `nas` — tambah row baru saat `AccelPppServer` dibuat (sync transactional).
- `radacct` — read-only dari app (untuk track NAS aktif per session).

### 4.4 Relasi pelanggan ke server

- **Tidak ada FK** pelanggan → server (sesuai keputusan any-server).
- Pelanggan punya credential di `radcheck`. Saat aktif, server tempat session
  ditrack via `radacct.nasipaddress`.

### 4.5 Permission catalog

Tambah ke `lib/permission-config.ts`:
- `network:accel-ppp:read`
- `network:accel-ppp:create`
- `network:accel-ppp:update`
- `network:accel-ppp:delete`
- `network:accel-ppp:kick`

Hook ke role default (Admin, NetworkOps) sesuai pattern existing.

---

## 5. Data Flow

### 5.1 Admin create accel-ppp server

```
[Admin UI] POST /api/accel-ppp-servers
   ↓
[API route]
  - requireFullRadiusMode() → 403 jika OFF
  - hasPermission("network:accel-ppp:create") → 403 jika no permission
   ↓
[Validator Zod] accelPppServerCreateSchema
   ↓
[AccelPppServerService.create]
  ├── (optional pre-check) AccelPppCliClient.testConnection
  ├── prisma.$transaction:
  │     ├── AccelPppServerRepository.create
  │     └── RadiusRepository.upsertNas({ nasname, shortname, secret })
  └── Audit log
   ↓
[Response] 201 { id, name, ... }
   ↓
[UI] React Query invalidate
```

### 5.2 Pelanggan dial-up (any-server)

```
[Pelanggan service] (existing) upsert radcheck/radreply/radusergroup
   ↓
[FreeRADIUS] AccessRequest masuk dengan NAS-IP X
  - huntgroups match → set Huntgroup-Name = "accel-ppp" atau "mikrotik"
  - policy.d/per-nas-routing apply attribute spesifik:
      if huntgroup=mikrotik → reply Mikrotik-Rate-Limit
      if huntgroup=accel-ppp → reply Filter-Id atau accel-spec
  - AccessAccept
   ↓
[NAS] enforce bandwidth + kirim Accounting Start
   ↓
[FreeRADIUS] insert radacct row
```

### 5.3 Live monitoring dashboard

```
[UI page] polling /api/accel-ppp-servers/[id]/sessions tiap 10s
   ↓
[API route] guards (full radius mode + permission)
   ↓
[AccelPppServerService.getLiveSessions(serverId)]
  ├── repo.findById → ambil cliHost, cliPort, cliPassword
  ├── AccelPppCliClient.connect → "show sessions"
  ├── parse text → SessionDTO[]
  └── return
   ↓
[UI] render table
```

### 5.4 Kick session

```
[UI] click Kick di baris session
   ↓
[API POST /api/accel-ppp-servers/[id]/sessions/[username]/kick]
   ↓
[AccelPppServerService.kickSession(serverId, username)]
  ├── repo.findById
  ├── AccelPppCliClient.connect → "terminate username <u>"
  ├── verify response
  └── Audit log
   ↓
[Response] 200
```

### 5.5 Periodic health check

```
[lib/cron-registry] register every 30s:
   ↓
[AccelPppMonitor.checkAll]
  - repo.findAll
  - Promise.allSettled per server:
      ├── ICMP ping ipAddress
      ├── if up: CLI "show stat" → activeSessions count
      ├── if ping/CLI fail: pingStatus = "offline"
      └── repo.updateStatus({pingStatus, userOnline, lastStatusCheck})
```

---

## 6. Components

| Component | Tanggung jawab | Dependencies |
|---|---|---|
| `AccelPppServerEntity` | Domain entity (struct + invariants) | — |
| `IAccelPppServerRepository` | Port interface | — |
| `AccelPppServerRepository` | Prisma access | prisma |
| `AccelPppCliClient` | TCP socket 2001: connect, sendCommand, parseResponse, timeout | `net` |
| `AccelPppServerService` | CRUD orchestration, transactional FreeRADIUS sync, audit | repo, cliClient, RadiusRepository, settings |
| `AccelPppMonitor` | Periodic health check via cron | repo, cliClient, ping util |
| `requireFullRadiusMode` | Util/middleware: read setting, throw if OFF | settings service |
| FreeRADIUS config bundle | Static files versioned di `freeradius-config/` | — |

---

## 7. Error Handling

### 7.1 Domain errors

```typescript
class FullRadiusModeDisabledError extends DomainError    // 403
class AccelPppServerNotFoundError extends DomainError    // 404
class AccelPppDuplicateIpError extends DomainError       // 409
class AccelPppCliConnectionError extends DomainError     // 503
class AccelPppCliCommandError extends DomainError        // 503
class AccelPppCliTimeoutError extends DomainError        // 504
class AccelPppRadiusNasSyncError extends DomainError     // 503
class AccelPppSessionNotFoundError extends DomainError   // 404
```

API route catch → map ke `ApiErrors.*` dari `@/lib/api`.

### 7.2 Edge cases

| Skenario | Behavior |
|---|---|
| Toggle Full RADIUS Mode OFF saat server registered | API 403 untuk semua route accel-ppp. Data tetap di DB (tidak auto-delete). |
| Toggle ON tapi belum ada server | UI empty state "Belum ada server" |
| CLI socket timeout | `AccelPppCliTimeoutError` (default 5s). Monitor mark offline. |
| CLI auth gagal | `AccelPppCliCommandError`, log + flag server "auth_failed" |
| Duplicate IP saat create | `AccelPppDuplicateIpError` → 409 |
| Delete server yg ada session aktif | Tanpa `force=true` → 409 + count. Dengan force → cleanup nas row, no soft-disconnect. |
| FreeRADIUS DB unreachable saat create | TX rollback → `AccelPppRadiusNasSyncError` → 503 |
| Kick username yg tidak ada | `AccelPppSessionNotFoundError` → 404 (idempotent) |
| Monitor: 1 server timeout | `Promise.allSettled` isolate → server lain tetap diproses |
| FreeRADIUS belum punya nas row | AccessRequest reject. Mitigasi: NAS sync wajib sukses sebelum server aktif. UI flag `radius_nas_pending` jika sync gagal. |
| Per-NAS attribute mismatch | Out-of-scope app—config FreeRADIUS. Mitigasi: bundle config siap pakai + dokumentasi. |

### 7.3 Logging

- Tag `module:network`, `service:accel-ppp`
- CLI command/response → debug; strip credentials kalau ada
- Connection error → warn
- Repository/RADIUS sync error → error

### 7.4 Audit trail

- Create/update/delete `AccelPppServer` → audit log existing pattern
- Kick session → audit { actorId, targetUsername, serverId, timestamp }

---

## 8. Testing Strategy

### 8.1 Coverage target
- Service layer: ≥70%
- Critical path (auth, kick, transactional create): ≥90%

### 8.2 Layers

| Layer | Tool | Mocking | Lokasi |
|---|---|---|---|
| Unit (parser, validators) | Vitest | none | `tests/network/accel-ppp/unit/` |
| Service | Vitest | mock repo + CLI; real Zod | `tests/network/accel-ppp/services/` |
| Repository | Vitest + real test DB | real Prisma | `tests/network/accel-ppp/repositories/` |
| Integration | Vitest | real DB + real RadiusDB; mock CLI socket | `tests/network/accel-ppp/integration/` |
| E2E UI | Playwright | stub API atau test DB | `tests/e2e/accel-ppp/` |

### 8.3 Concrete tests (high-priority)

**`AccelPppServerService.create`:**
- Happy path → server di DB + nas row di RADIUS DB
- Setting OFF → `FullRadiusModeDisabledError`
- Duplicate IP → `AccelPppDuplicateIpError`
- RADIUS NAS sync gagal → rollback Prisma
- Validation invalid → Zod throw

**`AccelPppCliClient`:**
- Connect + sendCommand + parse `show sessions` (golden fixtures)
- Parse `show stat`
- Timeout 5s
- Connection unreachable
- Auth failure

**`AccelPppMonitor.checkAll`:**
- Multi-server parallel via `Promise.allSettled`
- 1 server timeout → lain tetap diproses
- Status transition online↔offline

**API routes:**
- `requireFullRadiusMode` middleware: 403 saat OFF
- POST: 201/409/422/503 sesuai skenario
- DELETE active session: 409 tanpa force, 200 dengan force
- Kick: 200/404
- `hasPermission` match catalog `lib/permission-config.ts`

### 8.4 Fixtures
- `fixtures/accel-ppp/show-sessions-empty.txt`
- `fixtures/accel-ppp/show-sessions-multi.txt`
- `fixtures/accel-ppp/show-stat.txt`
- `fixtures/accel-ppp/auth-failed.txt`

### 8.5 Mock strategy
- ❌ Tidak mock Prisma — pakai real test DB (`./scripts/setup-test-db.sh`)
- ❌ Tidak mock RADIUS DB — pakai test instance `prismaRadius`
- ✅ Mock CLI socket pakai `net.createServer` lokal
- ✅ Mock ICMP ping via injected dependency

### 8.6 Verifikasi sebelum task ditutup
- `npm run lint`
- `npm run typecheck`
- `npm test -- network/accel-ppp` lulus
- `npm run build` lulus
- Manual smoke: toggle Full RADIUS Mode ON/OFF → API guard respons benar
- Manual lab: dial PPPoE dari accel-ppp box dummy → AccessAccept dengan attribute benar

---

## 9. Implementation Sequence

### M1 — Foundation
- Migration `AccelPppServer`
- Setting `fullRadiusMode` di `modules/settings`
- Domain entity, port, errors, validator
- Repository CRUD
- Public API export

### M2 — CLI Client
- `AccelPppCliClient` (connect, command, parser, timeout)
- Parser untuk `show sessions`, `show stat`, `terminate`
- Fixtures + unit tests

### M3 — Service + RADIUS NAS sync
- `AccelPppServerService`
- Transactional Prisma + RADIUS `nas` upsert
- `requireFullRadiusMode` util
- Audit log integration

### M4 — API routes + Authorization
- 5 endpoint routes
- Tambah permission entries di catalog
- Hook ke role default
- Integration tests

### M5 — Monitor
- `AccelPppMonitor.checkAll`
- Register di `lib/cron-registry.ts` (interval 30s)
- `Promise.allSettled` isolation

### M6 — Admin UI
- 3 pages (list, new, detail)
- Sidebar conditional rendering via `useFullRadiusMode`
- Settings page entry untuk toggle
- React Query data fetching
- Sessions polling 10s atau Socket.IO (cek pola MikroTik dashboard)

### M7 — FreeRADIUS Config Bundle + Docs
- `freeradius-config/` versioned bundle
- `docs/guides/accel-ppp-setup.md`
- `docs/CHANGELOG.md` entry (sesuai SOT policy)

### Dependency graph
```
M1 ──┬─→ M2 ─┐
     │       │
     ├───────┴─→ M3 ─→ M4 ─→ M6
     │           │
     │           └────→ M5
     │
     └───→ M7 (paralel)
```

---

## 10. Risk & Open Questions

| Risk / Question | Mitigasi / Note |
|---|---|
| Lokasi tepat `fullRadiusMode` di `modules/settings` | Cek struktur subfolder pengaturan saat implementasi M1; default ke settings network/umum. |
| Pola encryption untuk `radiusSecret` & `cliPassword` | Cek helper existing untuk `apiPassword` MikroTikRouter saat implementasi M1. |
| Pola Socket.IO vs polling untuk live sessions | Cek dashboard MikroTik existing saat M6; konsisten. |
| accel-ppp CLI auth implementation berbeda antar versi | Test di lab terhadap versi target; abstraksi parser by capability. |
| FreeRADIUS huntgroup config drift dengan box production | Bundle versioned di repo + dokumentasi diff/apply. |
| Behavior delete server saat banyak session aktif | Default block (409) tanpa force. Pertimbangkan future: send Disconnect-Request via CoA. |

---

## 11. Out of Scope (Future Work)

- Migrasi MikroTik existing ke pure-RADIUS auth (drop `/ppp/secret` provisioning).
- Failover otomatis antar PPPoE server (load balancer logic di app).
- Protokol selain PPPoE (L2TP, SSTP, PPTP).
- Multi-instance accel-ppp di satu IP (port-based).
- Auto-provisioning accel-ppp box (ansible/cloud-init).
- Disconnect-Request via CoA saat delete server.
