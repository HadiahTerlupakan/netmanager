# OLT-ONU Cascading Filter & Card Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement cascading OLT → Card → PON filter pada halaman `/admin/olt/onu`, plus model `OltCard` dengan auto-discovery dan UI manajemen card di halaman detail OLT.

**Architecture:** Tambah model Prisma `OltCard`, service `OltCardService` dengan branching per vendor, extend `OltOnuService.listOnus` untuk scope filter + global search, rewrite `OltOnuListClient.tsx` jadi state machine `idle|browsing|searching`.

**Tech Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, Zod, TypeScript, Tailwind CSS, Vitest, ZTE SNMP via `ZteSnmpClient`.

**Spec:** `docs/superpowers/specs/2026-05-23-olt-onu-cascading-filter-design.md`

---

## File Structure

### New Files
- `modules/olt/domain/entities/olt-card.entity.ts` — domain types
- `modules/olt/repositories/OltCardRepository.ts` — CRUD + listByOlt + upsertByPosition
- `modules/olt/services/OltCardService.ts` — listByOlt, syncCards, updateCard
- `modules/olt/validators/olt-card.validator.ts` — Zod schemas
- `app/api/olt/devices/[id]/cards/route.ts` — GET list cards
- `app/api/olt/devices/[id]/cards/sync/route.ts` — POST trigger sync
- `app/api/olt/devices/[id]/cards/[cardId]/route.ts` — PATCH update card
- `app/admin/olt/devices/[id]/OltCardSection.tsx` — UI section card management
- Tests: `modules/olt/repositories/__tests__/OltCardRepository.test.ts`, `modules/olt/services/__tests__/OltCardService.test.ts`, `modules/olt/adapters/zte/__tests__/ZteAdapter.discoverCards.test.ts`

### Modified Files
- `prisma/schema.prisma` — add OltCard + OltCardStatus enum + relation
- `lib/permission-config.ts` — add `olt_cards` resource
- `modules/olt/index.ts` — export public API
- `modules/olt/domain/ports/IOltAdapter.ts` — optional `discoverCards`
- `modules/olt/adapters/zte/ZteAdapter.ts` — implement `discoverCards`
- `modules/olt/config/oid-registry/zte.oid.ts` — add card OIDs
- `modules/olt/repositories/OnuRepository.ts` — extend `buildWhere` + `OnuListFilters`
- `modules/olt/services/OltOnuService.ts` — extend `OnuListFilters` interface
- `modules/olt/validators/onu.validator.ts` — extend `onuListQuerySchema`
- `app/api/olt/onu/route.ts` — parse new params
- `app/admin/olt/onu/OltOnuListClient.tsx` — full rewrite
- `app/admin/olt/devices/[id]/OltDeviceDetailClient.tsx` — import OltCardSection
- `docs/CHANGELOG.md` — entries

---

## Task 1: Schema — Add `OltCard` Model & Migration

**Files:** `prisma/schema.prisma`

- [ ] Tambah `enum OltCardStatus { ACTIVE MAINTENANCE OFFLINE }` sebelum model OltDevice
- [ ] Tambah model `OltCard` setelah model OltDevice:
```prisma
model OltCard {
  id        String        @id @default(cuid())
  tenantId  String
  oltId     String
  slotFrame Int
  slot      Int
  cardType  String?
  ponCount  Int
  status    OltCardStatus @default(ACTIVE)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  olt OltDevice @relation(fields: [oltId], references: [id], onDelete: Cascade)

  @@unique([oltId, slotFrame, slot])
  @@index([tenantId])
  @@map("olt_cards")
}
```
- [ ] Tambah reverse relation `cards OltCard[]` di dalam model OltDevice
- [ ] Run `npx prisma migrate dev --name add_olt_card_table`
- [ ] Run `npm run typecheck` — verify PASS
- [ ] Commit: `feat(olt): add OltCard model and migration`

---

## Task 2: Permission — Register `olt_cards` Resource

**Files:** `lib/permission-config.ts`

- [ ] Ubah baris `OLT: ["olt", "olt_devices", "olt_onu", "olt_logs", "olt_vlan"]` menjadi `OLT: ["olt", "olt_devices", "olt_onu", "olt_logs", "olt_vlan", "olt_cards"]`
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): register olt_cards permission resource`

---

## Task 3: Domain Entity — `olt-card.entity.ts`

**Files:** Create `modules/olt/domain/entities/olt-card.entity.ts`

- [ ] Define types: `OltCard`, `OltCardListItem` (extends OltCard + `onuCount: number`), `OltCardUpsertInput`, `OltCardUpdateInput`, `DiscoveredCard`, `OltCardErrorCode`, `OltCardError`
- [ ] Lihat spec section 4.1 & 4.4 untuk semua fields
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): add OltCard domain entity types`

---

## Task 4: Validator — `olt-card.validator.ts`

**Files:** Create `modules/olt/validators/olt-card.validator.ts`

- [ ] Schema `updateOltCardSchema`:
  - `cardType`: `z.string().max(50).nullable().optional()`
  - `ponCount`: `z.coerce.number().int().min(1).max(64).optional()`
  - `status`: `z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE"]).optional()`
- [ ] Schema `listOltCardsQuerySchema`:
  - `oltId`: `z.string().min(1)`
- [ ] Export types: `UpdateOltCardInput`, `ListOltCardsQuery`
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): add OltCard validators`

---

## Task 5: Repository — `OltCardRepository.ts` + Tests

**Files:** Create `modules/olt/repositories/OltCardRepository.ts`, `modules/olt/repositories/__tests__/OltCardRepository.test.ts`

- [ ] **Write tests first** (real DB via test setup):
  - `upsertByPosition` — insert new, then update existing at same position (stays 1 row)
  - `listByOlt` — returns cards sorted by slotFrame ASC, slot ASC, with onuCount
  - `updateById` — updates cardType/ponCount/status
  - Tenant isolation — tenantA cannot see tenantB cards
- [ ] Run tests: `npx vitest run modules/olt/repositories/__tests__/OltCardRepository.test.ts` — FAIL
- [ ] **Implement repository methods:**
  - `upsertByPosition(input: OltCardUpsertInput): Promise<OltCard>` — prisma.oltCard.upsert on `@@unique([oltId, slotFrame, slot])`
  - `listByOlt(tenantId: string, oltId: string): Promise<OltCardListItem[]>` — findMany + groupBy count OnuDevice per (oltId, slotFrame, slot)
  - `updateById(id: string, tenantId: string, input: OltCardUpdateInput): Promise<OltCard>`
  - `findById(id: string, tenantId: string): Promise<OltCard | null>`
- [ ] Run tests — PASS
- [ ] Commit: `feat(olt): add OltCardRepository with tests`

---

## Task 6: Adapter Port — Extend `IOltAdapter` + ZTE OID

**Files:** Modify `modules/olt/domain/ports/IOltAdapter.ts`, `modules/olt/config/oid-registry/zte.oid.ts`

- [ ] Tambah optional method di `IOltAdapter`:
```ts
discoverCards?(device: OltDevice): Promise<ServiceResult<DiscoveredCard[]>>;
```
- [ ] Import `DiscoveredCard` dari `olt-card.entity.ts`
- [ ] Tambah OID di `zte.oid.ts`:
```ts
// Card management OIDs (branch zxAN-SHELF-MIB: 1.3.6.1.4.1.3902.1015.100)
CARD_TYPE_TABLE: "1.3.6.1.4.1.3902.1015.100.1.1.5",
CARD_OPER_STATUS: "1.3.6.1.4.1.3902.1015.100.1.1.7",
```
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): extend IOltAdapter with discoverCards + ZTE card OIDs`

---

## Task 7: ZTE Adapter — `discoverCards()` + Tests

**Files:** Modify `modules/olt/adapters/zte/ZteAdapter.ts`, Create test file

- [ ] **Write tests** (mock `ZteSnmpClient.walk`):
  - Walk returns 3 entries → parse 3 DiscoveredCard with correct slotFrame/slot
  - Walk returns empty → returns empty array (not error)
  - Walk timeout → ServiceResult error code `SNMP_TIMEOUT`
  - Status mapping: 1=ACTIVE, 2=MAINTENANCE, else=OFFLINE
- [ ] Run tests — FAIL
- [ ] **Implement `ZteAdapter.discoverCards(device)`:**
  1. SNMP walk `CARD_TYPE_TABLE` → parse OID suffix `(rack.shelf.slot)` → `(slotFrame, slot)`, value = cardType string
  2. Filter entries with non-empty cardType (slot has card)
  3. SNMP walk `CARD_OPER_STATUS` → map integer to OltCardStatus
  4. ponCount default = 8 (log warn for manual correction)
  5. Return list `DiscoveredCard[]`
  6. On SNMP timeout → `{ success: false, error: "SNMP timeout", code: "SNMP_TIMEOUT" }`
- [ ] Run tests — PASS
- [ ] Commit: `feat(olt): implement ZteAdapter.discoverCards via SNMP`

---

## Task 8: Service — `OltCardService` + Tests

**Files:** Create `modules/olt/services/OltCardService.ts`, `modules/olt/services/__tests__/OltCardService.test.ts`

- [ ] **Write tests** (mock adapter via OltAdapterFactory, real DB):
  - `syncCards` ZTE happy: adapter returns 3 cards → 3 rows upserted, returns `{ synced: 3, mode: 'snmp' }`
  - `syncCards` ZTE error: adapter returns error → service returns `ADAPTER_ERROR`
  - `syncCards` ZTE no snmpCommunity → returns `INVALID_CONFIG`
  - `syncCards` HSGQ: no adapter call, seed 1 BUILTIN card from device defaults
  - `syncCards` HSGQ no totalPonPorts → returns `INVALID_CONFIG`
  - `syncCards` idempotent: call 2x same data → still 1 row per position
  - `updateCard` valid input → updated
  - `updateCard` card not found → `CARD_NOT_FOUND`
  - `listByOlt` returns cards with onuCount
  - Tenant isolation
- [ ] Run tests — FAIL
- [ ] **Implement `OltCardService`:**
```ts
export class OltCardService {
  private repo = new OltCardRepository();
  private oltRepo = new OltRepository();
  private adapterFactory = new OltAdapterFactory();

  async listByOlt(tenantId: string, oltId: string): Promise<Result<OltCardListItem[], OltCardError>>
  async syncCards(tenantId: string, oltId: string): Promise<Result<{ synced: number; mode: string }, OltCardError>>
  async updateCard(tenantId: string, oltId: string, cardId: string, input: OltCardUpdateInput): Promise<Result<OltCard, OltCardError>>
}
```
  - `syncCards` flow: load device → validate tenant → validate config → branch vendor (ZTE: discoverCards / others: seed BUILTIN) → upsertByPosition loop → return count
- [ ] Run tests — PASS
- [ ] Commit: `feat(olt): add OltCardService with sync and CRUD`

---

## Task 9: API Routes — Cards CRUD + Sync

**Files:** Create route files + tests

- [ ] **Write route tests** (per endpoint):
  - `GET /api/olt/devices/[id]/cards` — 401/403/200 with cards list
  - `POST /api/olt/devices/[id]/cards/sync` — 401/403/400(invalid config)/200
  - `PATCH /api/olt/devices/[id]/cards/[cardId]` — 401/403/400(zod)/404/200
- [ ] Run tests — FAIL
- [ ] **Implement routes:**
  - Pattern: `getServerSession` → `hasPermission("olt_cards:read|update")` → Zod validate → service call → `apiSuccess` / `ApiErrors.*`
  - GET: `OltCardService.listByOlt(session.user.tenantId, id)` → map Result to response
  - POST sync: `OltCardService.syncCards(session.user.tenantId, id)` → map error codes to HTTP status (INVALID_CONFIG→400, SNMP_TIMEOUT/ADAPTER_ERROR→502, OLT_NOT_FOUND→404)
  - PATCH: `OltCardService.updateCard(session.user.tenantId, id, cardId, body)` → map to response
- [ ] Run tests — PASS
- [ ] Commit: `feat(olt): add card API routes (list, sync, update)`

---

## Task 10: Extend ONU Validator & Filters

**Files:** Modify `modules/olt/validators/onu.validator.ts`, `modules/olt/repositories/OnuRepository.ts`, `modules/olt/services/OltOnuService.ts`

- [ ] **Extend `onuListQuerySchema`** — add optional fields:
```ts
slotFrame: z.coerce.number().int().min(0).optional(),
slot: z.coerce.number().int().min(0).optional(),
ponPort: z.coerce.number().int().min(1).optional(),
```
- [ ] **Extend `OnuListFilters` interface** in both `OnuRepository.ts` and `OltOnuService.ts`:
```ts
slotFrame?: number;
slot?: number;
ponPort?: number;
```
- [ ] **Rewrite `OnuRepository.buildWhere`:**
```ts
private buildWhere(filters: OnuListFilters) {
  const where: Record<string, unknown> = { tenantId: filters.tenantId };

  if (filters.search) {
    where.OR = [
      { serialNumber: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { pelanggan: { nama: { contains: filters.search, mode: "insensitive" } } },
    ];
  } else {
    if (filters.oltId) where.oltId = filters.oltId;
    if (filters.slotFrame !== undefined) where.slotFrame = filters.slotFrame;
    if (filters.slot !== undefined) where.slot = filters.slot;
    if (filters.ponPort !== undefined) where.ponPort = filters.ponPort;
  }

  if (filters.status) where.status = filters.status;
  return where;
}
```
- [ ] **Extend `findMany`** — update include to add pelanggan relation: `include: { pelanggan: { select: { nama: true } }, olt: { select: { name: true, vendor: true } } }`
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): extend ONU list filters with scope + global search`

---

## Task 11: ONU List Filter Tests

**Files:** Create/extend `modules/olt/services/__tests__/OltOnuService.test.ts`

- [ ] **Write tests:**
  - `listOnus` with `oltId` only → returns ONU from that OLT
  - `listOnus` with `oltId + slotFrame + slot` → returns ONU at that card position
  - `listOnus` with `oltId + slotFrame + slot + ponPort` → returns ONU at that PON
  - `listOnus` with `search` only → global OR-match SN/description/pelanggan.nama
  - `listOnus` with `search + oltId` → server IGNORES oltId (global search)
  - `listOnus` with `search + status` → status still applies
  - Pagination total count is accurate
- [ ] Run tests — verify PASS (implementation from Task 10 already wired)
- [ ] Commit: `test(olt): add ONU list scope + global search tests`

---

## Task 12: Extend `/api/olt/onu` Route to Parse New Params

**Files:** Modify `app/api/olt/onu/route.ts`

- [ ] Update query parsing to include new fields:
```ts
const query = onuListQuerySchema.parse({
  page: searchParams.get("page") ?? undefined,
  limit: searchParams.get("limit") ?? undefined,
  oltId: searchParams.get("oltId") ?? undefined,
  slotFrame: searchParams.get("slotFrame") ?? undefined,
  slot: searchParams.get("slot") ?? undefined,
  ponPort: searchParams.get("ponPort") ?? undefined,
  status: searchParams.get("status") ?? undefined,
  search: searchParams.get("search") ?? undefined,
});
```
- [ ] Run `npm run typecheck` — PASS
- [ ] Commit: `feat(olt): wire new scope params in ONU list API route`

---

## Task 13: UI — Card Section di Detail OLT

**Files:** Create `app/admin/olt/devices/[id]/OltCardSection.tsx`, Modify `app/admin/olt/devices/[id]/OltDeviceDetailClient.tsx`

- [ ] **Create `OltCardSection.tsx`:**
  - Props: `{ oltId: string; vendor: string }`
  - State: `cards[]`, `loading`, `syncing`, `editingCard`, `editForm`
  - Fetch on mount: `GET /api/olt/devices/${oltId}/cards`
  - Tombol "Sync Cards": `POST /api/olt/devices/${oltId}/cards/sync` → reload
  - Table (ResponsiveTable): Frame, Slot, Type, PON Count, Status, ONU Count, Aksi(Edit)
  - Edit inline form: `cardType`, `ponCount`, `status` → `PATCH`
  - Empty state: "Belum ada data card. Klik 'Sync Cards' untuk mulai."
  - Vendor subtitle: ZTE → "Sync via SNMP card table" / lainnya → "Pizza-box, 1 card BUILTIN"
- [ ] **Modify `OltDeviceDetailClient.tsx`:**
  - Import dan render `<OltCardSection oltId={id} vendor={device.vendor} />` setelah card info device
- [ ] Run `npm run typecheck` — PASS
- [ ] Test manual di browser: buka `/admin/olt/devices/<id>` → card section visible
- [ ] Commit: `feat(olt): add card management section in OLT detail page`

---

## Task 14: UI — Rewrite ONU List with Cascading Filter

**Files:** Rewrite `app/admin/olt/onu/OltOnuListClient.tsx`

- [ ] **Implement state machine:**
  - `mode: 'idle'|'browsing'|'searching'`
  - `selectedOltId`, `selectedCard` (object: id/slotFrame/slot/ponCount), `selectedPonPort`
  - `searchQuery` (debounce 300ms), `statusFilter`, `page`
- [ ] **Dropdowns:**
  - OLT: fetch `GET /api/olt/devices?status=ACTIVE&limit=200`
  - Card: fetch `GET /api/olt/devices/${oltId}/cards` when OLT selected; disabled when no OLT
  - PON: generate 1..card.ponCount; disabled when no card selected
- [ ] **Search behavior:**
  - Non-empty → `mode='searching'`, grey-out scope dropdowns (opacity-50 + pointer-events-none)
  - Clear → `mode='browsing'`, restore scope state
- [ ] **Data fetching:**
  - `search` active → params: `{ search, status, page, limit }`
  - scope active → params: `{ oltId, slotFrame, slot, ponPort, status, page, limit }`
  - idle → no fetch
- [ ] **Empty states:**
  - idle: "Pilih OLT atau ketik pencarian untuk memulai"
  - browsing 0: "Tidak ada ONU pada scope ini"
  - searching 0: "Tidak ada ONU dengan kata kunci '{query}'"
- [ ] Retain buttons "Unregistered" + "Pre-Register" in header
- [ ] Table columns: SN, OLT, Frame/Slot/Port:Index, Status, VLAN, Pelanggan
- [ ] Run `npm run typecheck` — PASS
- [ ] Test manual di browser: full flow idle→browse→search→back
- [ ] Commit: `feat(olt): rewrite ONU list with cascading filter + global search`

---

## Task 15: Public API Export + Wiring

**Files:** Modify `modules/olt/index.ts`

- [ ] Tambah exports: `OltCardService`, `OltCardRepository`, validators, types
- [ ] Verify all API route imports resolve from `@/modules/olt`
- [ ] Run `npm run typecheck` + `npm run lint` — PASS
- [ ] Commit: `feat(olt): export OltCard public API from module index`

---

## Task 16: Changelog + Final Verification

**Files:** Modify `docs/CHANGELOG.md`

- [ ] Tambah entries `[ADDED]` (OltCard module + cascading filter UI) dan `[CHANGED]` (ONU endpoint extension) di `[Unreleased]`
- [ ] Run `npm run check` (lint + typecheck + build) — PASS
- [ ] Run `npm test -- --run` — PASS
- [ ] Commit: `docs(changelog): add cascading filter and card management entries`

---

## Summary

| Task | Scope | Est. |
|------|-------|------|
| 1 | Schema + migration | 5 min |
| 2 | Permission config | 2 min |
| 3 | Domain entity types | 3 min |
| 4 | Validator | 3 min |
| 5 | Repository + tests | 15 min |
| 6 | Adapter port + OID | 5 min |
| 7 | ZTE discoverCards + tests | 15 min |
| 8 | OltCardService + tests | 20 min |
| 9 | API routes + tests | 15 min |
| 10 | Extend ONU filters | 10 min |
| 11 | ONU filter tests | 10 min |
| 12 | Wire API route params | 3 min |
| 13 | UI card section | 20 min |
| 14 | UI ONU explorer rewrite | 30 min |
| 15 | Public API export | 5 min |
| 16 | Changelog + verify | 5 min |
| **Total** | | **~2.5 jam** |
