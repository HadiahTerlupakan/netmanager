# Fix Plan — Production Errors NetManager (2026-07-24)

**Server:** `radpro` (141.11.160.150) · namespace `netmanager-production`  
**Status pod:** semua Running, 0 restart app/worker (26h) — error di level aplikasi, bukan crash K8s  
**Author:** agent  
**Scope:** 6 error dari log 48 jam terakhir

---

## Ringkasan eksekusi

| # | Error | Severity | Tipe | Repo | Effort | Prioritas |
|---|--------|----------|------|------|--------|-----------|
| 1 | Overtime auto-checkout `Unknown argument tenantId` | **P0** | Code | netmanager | 15 menit | **Sekarang** |
| 2 | Mobile upload 401 token expired | **P0** | Code | mobile-netmanager | 0.5 hari | **Sekarang** |
| 3 | WhatsApp session THD Team putus | **P1** | Ops + Code | netmanager | Ops 5 mnt / code 0.5 hari | Ops dulu |
| 4 | MixRadius login timeout 60s | **P2** | Code + Ops | netmanager | 0.5 hari | Sprint |
| 5 | Mobile upload aborted / ECONNRESET | **P2** | Code harden | both | 0.5 hari | Sprint |
| 6 | Redis reconnection warning | **P3** | Ops / noise | netmanager | 1–2 jam | Optional |

**Urutan ship yang disarankan:**
1. Patch P0 overtime (netmanager) → deploy production
2. Patch P0 UploadService refresh (mobile) → OTA
3. Ops reconnect WA THD Team
4. Sprint: MixRadius + upload abort harden + WA routing pre-check

---

## 1. [P0] Overtime auto-checkout — Prisma `Unknown argument tenantId`

### Gejala
```
[Overtime] Failed to schedule/cancel auto checkout
PrismaClientValidationError: Unknown argument `tenantId`
  where: { overtimeId: "...", tenantId: "..." }
```
Juga memicu `[API Error] POST /api/mobile/overtime`.

### Root cause (bukan query repository salah)
- Model `OvertimeAutoCheckoutSchedule` **tidak punya kolom `tenantId`** (hanya `id` + `overtimeId` unique).
- Repository sudah benar: `findUnique({ where: { overtimeId } })`.
- Extension `withTenantIsolation` di [`lib/prisma-extension.ts`](../../lib/prisma-extension.ts) **inject `tenantId` ke semua `findUnique`** untuk non-superadmin.
- Model ini **belum** ada di `ignoreModels` di [`lib/prisma.ts`](../../lib/prisma.ts) (padahal child table sejenis sudah: `JournalLine`, `BankReconciliationLine`).

```
Mobile start overtime (tenant session)
  → prisma inject tenantId ke findUnique
  → model tidak punya field tenantId
  → PrismaClientValidationError
```

### Call chain
```
app/api/mobile/overtime → OvertimeService.startOvertime
  → OvertimeAutoCheckoutSchedulerService.schedule
    → OvertimeScheduleRepository.findByOvertimeId / upsert / attachJobId
```

### Fix (minimal, selaras arsitektur)

| Step | File | Action |
|------|------|--------|
| 1 | `lib/prisma.ts` | Tambah `"OvertimeAutoCheckoutSchedule"` ke array `ignoreModels` |
| 2 | (opsional) `prisma/schema.prisma` | Comment: `// no tenantId — isolated via Overtime parent; listed in ignoreModels` |
| 3 | Test | Regression: schedule ops dengan tenant context tidak throw |

**JANGAN:**
- Ubah query repository ke `findFirst` (extension tetap inject → error sama)
- Tambah kolom `tenantId` + migration (over-engineering; isolasi lewat parent `Overtime`)

### Isolasi tenant tetap aman karena
- Schedule 1:1 `overtimeId` (global unique)
- Entry path selalu lewat overtime yang sudah di-authorize
- Rehydration worker lintas-tenant by design

### Verification
```bash
npx vitest run tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts \
  tests/modules/overtime/OvertimeAutoCheckoutTask2RepositoryQueue.test.ts
```
- Mobile: `POST /api/mobile/overtime` action=start → 200, row `SCHEDULED` + `jobId` terisi
- action=stop → schedule `CANCELLED`
- Log production: error `Unknown argument tenantId` + `overtimeAutoCheckoutSchedule` hilang
- Optional: rehydrate IN_PROGRESS overtime yang miss schedule saat bug aktif

### Risk
| Risk | Level | Mitigasi |
|------|-------|----------|
| Cross-tenant raw read by UUID | Low | Perlu tebak UUID; app path lewat owned overtime |
| Start overtime sukses tapi schedule gagal (error di-swallow) | Medium existing | Fix ignore list restore scheduling |

### Deploy
- Code-only, no migration
- Deploy via pipeline main → production

---

## 2. [P0] Mobile upload 401 — Token expired

### Gejala
```
[MOBILE_AUTH] Token expired — client perlu refresh token
Upload failed with status 401: {"error":"Token tidak valid"}
Screen: CompleteWorkOrderScreen, AttendanceScreen
App: 1.0.0+53 (Android)
```

### Root cause
- Access token TTL **15 menit** (server benar menolak expired).
- Axios API path sudah punya 401 → refresh → retry.
- **Upload foto lewat `expo-file-system`**, **bypass** axios interceptor.
- `UploadService` ambil token sekali di awal; retry 2x tetap token lama.

```
Access 15m ─► JSON API (axios) ─► 401 ─► refresh ─► retry ✅
           └► Upload (FileSystem) ─► 401 ─► retry token LAMA ─► gagal ❌
```

### Fix (mobile-netmanager)

| Step | File | Action |
|------|------|--------|
| 1 | `src/services/UploadService.ts` | Sebelum upload: jika `TokenService.getExpiry()` ≤ now+60s → `RefreshTokenService.refreshAccessToken()` |
| 2 | Same | Pada response 401: refresh sekali (single-flight), update Bearer, retry 1x |
| 3 | Same | Jika refresh gagal final → throw clear / biarkan AUTH_UNAUTHORIZED |
| 4 | `__tests__/services/UploadService.test.ts` | Case: 401→refresh→success; 401→refresh fail; near-expiry proactive |
| 5 | Ship | OTA `eas update` (JS-only, fingerprint build +53) |

**Tidak ubah:** CompleteWorkOrder / Attendance screen (cukup fix service).  
**Jangan:** perpanjang access TTL di server sebagai “fix”.

### Verification
- Idle app >15 menit → absensi + complete WO multi-foto sukses
- Offline queue (`SyncService`) upload setelah token expire
- Tidak ada logout loop

### Risk
| Risk | Level | Mitigasi |
|------|-------|----------|
| Race multi-upload 401 | Low | Single-flight refresh sudah ada di RefreshTokenService |
| Double-upload partial | Low | Server auth dulu sebelum process body |
| Refresh token 30d expired | Expected | User re-login |

---

## 3. [P1] WhatsApp — session THD Team putus

### Gejala
```
[WhatsAppSender] Failed via account THD Team
[WO Reminder] WA failed: Session ... belum terkoneksi
```

### Root cause
- `sendBaileysMessage` return error jika session tidak `connected` di pod lokal **dan** Redis remote.
- Penyebab ops: logout WA, conflict 440 multi-pod, pod restart tanpa PVC auth state, needs_reauth.
- Routing akun **tidak cek** status Baileys (hanya daily limit).

### Ops fix (sekarang — 5 menit)
1. Admin → Pengaturan → WhatsApp → akun **THD Team**
2. Cek status: `connected` / `disconnected` / `needs_reauth` / `qr`
3. Start / Scan QR ulang jika perlu
4. Pastikan volume `.baileys-sessions` survive redeploy
5. Test kirim dari UI

### Code fix (sprint)

| Step | File | Action |
|------|------|--------|
| 1 | `whatsapp-account-routing.service.ts` + `whatsapp-sender.service.ts` | Pre-check session status; skip/failover ke akun lain yang connected |
| 2 | `baileys-session-manager.ts` | Error actionable: bedakan `needs_reauth` vs `disconnected` |
| 3 | (opsional) cron/alert | Alert admin jika status ≠ connected > N menit |

### Verification
- UI status = `connected`
- Test send → log `Sent via account THD Team`
- Restart pod → session restore tanpa re-scan (jika auth persist)

---

## 4. [P2] MixRadius login timeout 60s

### Gejala
```
[MixRadius] Login error: timeout of 60000ms exceeded
```

### Root cause
- Timeout hardcode 60s di `mixradius-service.config.ts`
- Login flow: GET warmup + delay 0.8–2s + POST form — wall-clock mudah ≥60s jika host lambat
- **Login sendiri tidak ada retry** (retry hanya di fetch customers saat session expired)

### Ops fix
1. Dari pod: `curl -m 10 -I <MIXRADIUS_URL>/rad-admin`
2. Validasi credential tenant
3. Cek latency/DNS/firewall ke host MixRadius

### Code fix

| Step | File | Action |
|------|------|--------|
| 1 | `mixradius-service.config.ts` | Timeout login terpisah (20–30s); env `MIXRADIUS_TIMEOUT_MS` |
| 2 | `mixradius-auth-client.ts` | 1 retry + backoff; bedakan ETIMEDOUT vs credential invalid |
| 3 | `MixRadiusService.ts` | Circuit-breaker: short-circuit fail login 1–2 menit (cegah storm) |
| 4 | Test | `tests/modules/integrations/mixradius-auth-client.test.ts` |

### Verification
- Login sukses + session reuse 50 menit
- MixRadius down → fail cepat (<30s), bukan hang 60s berulang

---

## 5. [P2] Mobile upload aborted / ECONNRESET

### Gejala
```
Mobile upload error: Error: aborted
code: ECONNRESET
Mobile error report: "No Internet connection"
```

### Root cause
- Mayoritas **client/network** (sinyal lapangan, app background, user cancel)
- Server treat abort sebagai ERROR 500 generik
- Ingress/Traefik timeout bisa potong upload panjang

### Fix

| Step | Side | File | Action |
|------|------|------|--------|
| 1 | Server | `app/api/mobile/upload/route-handlers-impl.ts` | Deteksi abort/ECONNRESET → 499/400, log **warn** bukan ERROR |
| 2 | Server | `app/api/mobile/upload/route.ts` | `export const maxDuration = 60` |
| 3 | Ops | Traefik/ingress | Timeout ≥ upload time |
| 4 | Mobile | `UploadService` | Retry 1–2x backoff (selain token refresh); compress image |

### Verification
- Upload 1–3MB normal → 200
- Abort mid-upload → warn log, bukan error storm
- 3G/edge + retry → sukses

---

## 6. [P3] Redis reconnection warning

### Gejala
```
[Redis] Reconnection attempt 1, retrying in 1000ms
```

### Root cause
- Expected noise saat brief blip (ioredis infinite reconnect / BullMQ max 20)
- Hanya berbahaya jika loop terus, rate-limit fail-closed, worker stop, atau Baileys lock gagal

### Ops check
1. Frekuensi reconnect di log app + redis
2. `redis-cli INFO memory` — mendekati maxmemory 192mb?
3. Naikkan memory limit jika pressure sering
4. Pastikan `REDIS_URL` + password konsisten

### Code (optional)
- Throttle reconnect logs (1× / 30s) di `lib/redis.ts` + `lib/event-bus/redis-connection.ts`
- Alert jika reconnect > N/menit

---

## File map

```
P0 Overtime:
  lib/prisma.ts                                          ← ignoreModels

P0 Mobile token upload:
  ../mobile-netmanager/src/services/UploadService.ts
  ../mobile-netmanager/__tests__/services/UploadService.test.ts

P1 WhatsApp:
  modules/notification/services/whatsapp-sender.service.ts
  modules/notification/services/whatsapp-account-routing.service.ts
  modules/notification/services/whatsapp/baileys-session-manager.ts
  app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx   (ops UI)

P2 MixRadius:
  modules/integrations/services/mixradius-service.config.ts
  modules/integrations/services/mixradius-auth-client.ts
  modules/integrations/services/MixRadiusService.ts

P2 Upload abort:
  app/api/mobile/upload/route.ts
  app/api/mobile/upload/route-handlers-impl.ts

P3 Redis:
  lib/redis.ts
  lib/event-bus/redis-connection.ts
  k8s/production/redis-deployment.yaml
```

---

## Checklist implementasi

### Phase A — Hotfix (hari ini)
- [ ] `lib/prisma.ts`: ignore `OvertimeAutoCheckoutSchedule`
- [ ] Unit test overtime schedule + manual start/stop overtime
- [ ] Deploy netmanager production
- [ ] `UploadService.ts`: pre-emptive + on-401 refresh
- [ ] Unit test UploadService
- [ ] OTA mobile production
- [ ] Ops: reconnect WA THD Team + test send
- [ ] Smoke: idle 15m → absensi + complete WO; start overtime → schedule row ada

### Phase B — Sprint harden
- [ ] WA routing skip disconnected account + actionable errors
- [ ] MixRadius timeout/retry/circuit-breaker
- [ ] Upload abort → warn 499, maxDuration
- [ ] (opsional) Redis log throttle + memory check

### Phase C — Closeout
- [ ] Update `docs/CHANGELOG.md` (`[FIXED]` overtime isolation; `[FIXED]` mobile upload refresh; dst.)
- [ ] Scan log 24h post-deploy: 6 error pattern harus turun tajam
- [ ] Residual: rehydrate overtime IN_PROGRESS yang miss schedule (jika ada)

---

## Acceptance criteria (done when)

1. **0** log `Unknown argument tenantId` + `overtimeAutoCheckoutSchedule` dalam 24 jam
2. Mobile start/stop overtime sukses; row schedule `SCHEDULED`/`CANCELLED` benar
3. Idle >15m: absensi + complete WO upload **tidak** 401
4. WA test send THD Team sukses (atau failover ke akun lain)
5. MixRadius down: fail cepat, tidak hang 60s berulang
6. Client abort upload: log warn, bukan ERROR storm

---

## Out of scope

- Perpanjang access token TTL
- Migration tambah `tenantId` ke `OvertimeAutoCheckoutSchedule`
- Rebuild APK native (fix upload = JS OTA cukup)
- Redesain multi-pod Baileys (cukup reconnect + routing pre-check dulu)
