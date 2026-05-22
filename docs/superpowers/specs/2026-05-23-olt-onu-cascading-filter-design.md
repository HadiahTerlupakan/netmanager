# ONU Cascading Filter + Card Management — Design Spec

**Date:** 2026-05-23
**Status:** Approved (siap untuk implementation plan)
**Owner:** agent
**Scope:** `modules/olt`, `app/admin/olt/onu`, `app/admin/olt/devices/[id]`, `app/api/olt/devices/[id]/cards/*`, `app/api/olt/onu`

---

## 1. Problem Statement

Halaman `Daftar ONU` saat ini (`app/admin/olt/onu/OltOnuListClient.tsx`) menampilkan list flat semua ONU lintas OLT dengan filter status + search SN sederhana. Ketika jumlah ONU mencapai puluhan ribu di beberapa OLT, flow ini tidak dapat diskalakan dan tidak merefleksikan struktur fisik perangkat.

OLT chassis (ZTE C300/C320/C620) memiliki banyak slot card; setiap card berisi 8/16 PON port; setiap PON menampung sampai 128 ONU. OLT pizza-box (HSGQ/HIOSO/CDATA) tidak punya konsep card terpisah — langsung punya 4/8/16 PON.

Operator sering perlu menavigasi struktur ini secara berjenjang **atau** mencari ONU spesifik via SN/deskripsi/nama pelanggan tanpa tahu lebih dulu di OLT mana ONU berada.

## 2. Goals

1. UI cascading filter **OLT → Card → PON** untuk navigasi struktur fisik
2. Pencarian global SN / deskripsi / nama pelanggan lintas OLT yang independen dari scope yang dipilih
3. Schema baru `OltCard` untuk merepresentasikan card per OLT
4. Auto-discovery card via SNMP untuk ZTE; auto-seed BUILTIN untuk pizza-box
5. UI manajemen card di halaman detail OLT untuk koreksi manual

## 3. Non-Goals

- MAC address sebagai field pencarian (ditunda jadi spec terpisah; butuh migrasi `OnuDevice.macAddress` + sync per-vendor)
- Auto-prune card yang hilang dari hardware (operator set status manual ke OFFLINE pada versi awal)
- Halaman global "All Cards" lintas OLT
- CRUD manual card (card hanya hadir via sync atau seed)

## 4. Architecture

### 4.1 Schema Changes (Prisma)

Tambah model baru:

```prisma
model OltCard {
  id        String   @id @default(cuid())
  tenantId  String
  oltId     String
  slotFrame Int
  slot      Int
  cardType  String?
  ponCount  Int
  status    OltCardStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  olt OltDevice @relation(fields: [oltId], references: [id], onDelete: Cascade)

  @@unique([oltId, slotFrame, slot])
  @@index([tenantId])
  @@map("olt_cards")
}

enum OltCardStatus {
  ACTIVE
  MAINTENANCE
  OFFLINE
}
```

Catatan:
- **Tidak menambah FK** dari `OnuDevice` ke `OltCard`. Join via composite (`oltId`, `slotFrame`, `slot`) di service layer untuk menghindari migrasi data ONU yang sudah ada dan menoleransi anomali (ONU di slot yang belum ter-discover).
- `onDelete: Cascade` di relasi `olt` agar hapus OLT membersihkan cards.

Migration filename: `20260523000000_add_olt_card_table` (timestamp aktual saat implementasi).

### 4.2 Module Structure

```
modules/olt/
├── domain/
│   └── entities/
│       └── olt-card.entity.ts            # OltCard, OltCardCreateInput, OltCardUpdateInput, DiscoveredCard
│   └── ports/
│       └── IOltAdapter.ts                # tambah optional method discoverCards?()
├── repositories/
│   └── olt-card.repository.ts            # listByOlt, upsertByPosition, updateById, countOnusPerCard
├── services/
│   └── olt-card.service.ts               # listByOlt, syncCards, updateCard
├── validators/
│   └── olt-card.validator.ts             # Zod schema
├── adapters/zte/
│   └── ZteAdapter.ts                     # extend dengan discoverCards()
└── config/oid-registry/
    └── zte.oid.ts                        # tambah OID card table
```

### 4.3 ZTE Adapter — `discoverCards()`

OID baru di `zte.oid.ts`:
- `cardTypeTable`: `1.3.6.1.4.1.3902.1015.100.1.1.5` (zxAnCardType, string model card per slot)
- `cardOperStatus`: `1.3.6.1.4.1.3902.1015.100.1.1.7` (zxAnCardOperStatus)

Method:
```ts
async discoverCards(device: OltDevice): Promise<ServiceResult<DiscoveredCard[]>>
```

Logic:
1. SNMP walk `cardTypeTable` → parse OID suffix `(rack.shelf.slot)` → `(slotFrame, slot)`
2. Filter entry dengan nilai non-empty (slot terisi card)
3. SNMP walk `cardOperStatus` → mapping: `1=ACTIVE, 2=MAINTENANCE, lainnya=OFFLINE`
4. `ponCount` default 8 (heuristic untuk firmware C300; bisa direvisi via OID tambahan di iterasi berikut). Log warn agar operator bisa edit manual.
5. Return list `DiscoveredCard { slotFrame, slot, cardType, ponCount, status }`

Error mapping:
- SNMP timeout → `ServiceResult` dengan code `SNMP_TIMEOUT`
- Parse failure → log + skip entry, jangan fail keseluruhan
- Empty walk → return `[]` (sukses, bukan error)

### 4.4 Service Layer — `OltCardService`

```ts
class OltCardService {
  listByOlt(tenantId: string, oltId: string): Promise<Result<OltCardListItem[], OltCardError>>
  syncCards(tenantId: string, oltId: string): Promise<Result<{ synced: number; mode: 'snmp' | 'builtin' }, OltCardError>>
  updateCard(tenantId: string, oltId: string, cardId: string, input: OltCardUpdateInput): Promise<Result<OltCard, OltCardError>>
}
```

`syncCards` flow:
1. Load device, validasi tenant ownership
2. Validate prerequisites:
   - ZTE: butuh `snmpCommunity` non-null → else `INVALID_CONFIG`
   - Lainnya: butuh `defaultSlotFrame`, `defaultSlot`, `totalPonPorts` non-null/positive → else `INVALID_CONFIG`
3. Branch by vendor:
   - `ZTE` → `OltAdapterFactory.get('ZTE').discoverCards(device)` → upsert tiap card
   - `HSGQ`/`HIOSO`/`CDATA` → upsert 1 card `{ slotFrame: device.defaultSlotFrame, slot: device.defaultSlot, cardType: 'BUILTIN', ponCount: device.totalPonPorts, status: 'ACTIVE' }`
4. Return `{ synced: N, mode: 'snmp' | 'builtin' }`

`listByOlt` returns `OltCardListItem[]` dengan `onuCount` per card (groupBy query 1x untuk efisiensi).

`updateCard` validation:
- `ponCount` 1..64
- `status` ∈ enum OltCardStatus
- `cardType` max 50 chars
- `slotFrame`/`slot` immutable

Error codes: `OLT_NOT_FOUND`, `INVALID_CONFIG`, `SNMP_TIMEOUT`, `ADAPTER_ERROR`, `CARD_NOT_FOUND`, `UNSUPPORTED_VENDOR`.

### 4.5 API Routes

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/olt/devices/[id]/cards` | `olt_card:read` | List card untuk OLT |
| `POST` | `/api/olt/devices/[id]/cards/sync` | `olt_card:sync` | Trigger sync (SNMP atau seed BUILTIN) |
| `PATCH` | `/api/olt/devices/[id]/cards/[cardId]` | `olt_card:write` | Update cardType/ponCount/status |

Pola standar: `getServerSession` → `hasPermission` → Zod validate → service call → `apiSuccess` / `ApiErrors.*`.

### 4.6 Modifikasi Endpoint ONU

`GET /api/olt/onu` — extend `onuListQuerySchema` dengan optional:
- `oltId?: string`
- `slotFrame?: number`
- `slot?: number`
- `ponPort?: number`

`OltOnuService.listOnus` extend filter:
- Saat `search` non-empty → **abaikan** `oltId`/`slotFrame`/`slot`/`ponPort` (search global)
- Saat `search` empty → apply scope filters AND
- `status` selalu apply (kombinasi dengan search atau scope)
- Search field expand ke OR-match: `serialNumber`, `description`, `pelanggan.nama` (via Prisma include relasi)

### 4.7 Permissions

Tambah di `lib/permission-config.ts`:
- `olt_card:read`
- `olt_card:write`
- `olt_card:sync`

## 5. UI Design

### 5.1 Halaman ONU Explorer (`/admin/olt/onu`)

**File:** `app/admin/olt/onu/OltOnuListClient.tsx` (rewrite)

**State machine:**
```
mode: 'idle' | 'browsing' | 'searching'
selectedOltId: string | null
selectedCardId: string | null     // null = "Semua Card"
selectedPonPort: number | null    // null = "Semua PON"
searchQuery: string
statusFilter: string
```

Transisi:
- `idle` → `browsing` saat OLT dipilih
- `browsing` → `searching` saat `searchQuery.length > 0`
- `searching` → `browsing` saat search dikosongkan (state scope dipertahankan)
- → `idle` saat OLT di-unselect

**Layout (atas ke bawah):**
1. Header: judul + tombol "Unregistered", "Pre-Register" (dipertahankan)
2. Search bar full-width (debounce 300ms): "Cari SN, deskripsi, atau nama pelanggan (lintas semua OLT)"
3. Scope filter row (grey-out saat searching):
   - Dropdown OLT
   - Dropdown Card (disabled sampai OLT dipilih)
   - Dropdown PON (disabled sampai Card dipilih)
   - Dropdown Status (selalu aktif)
4. Content area:
   - `idle`: empty state "Pilih OLT atau ketik pencarian untuk memulai"
   - `browsing`: ResponsiveTable hasil scope
   - `searching`: ResponsiveTable hasil global + badge "Pencarian global aktif"

**Behavior detail:**
- Dropdown OLT: fetch `GET /api/olt/devices?status=ACTIVE&limit=200`, sortir by `name`
- Dropdown Card: saat OLT dipilih, fetch `GET /api/olt/devices/[id]/cards`. Default "Semua Card". Kalau hasil 0 (belum sync), placeholder "Belum ada card. Sync di halaman OLT" + auto-fallback "Semua Card"
- Dropdown PON: generate `1..card.ponCount`, default "Semua PON"
- Search: debounce 300ms, saat ≥1 karakter → grey-out scope dropdown (opacity-50, pointer-events-none) + badge
- Status filter: tetap aktif di kedua mode
- Saat search dikosongkan: state scope tetap, langsung re-fetch dengan scope itu

**Query params yang dikirim ke `/api/olt/onu`:**
```
{
  page,
  limit: 20,
  status: statusFilter || undefined,
  search: searchQuery || undefined,
  oltId: searchQuery ? undefined : (selectedOltId || undefined),
  slotFrame: searchQuery ? undefined : (selectedCard?.slotFrame || undefined),
  slot: searchQuery ? undefined : (selectedCard?.slot || undefined),
  ponPort: searchQuery ? undefined : (selectedPonPort || undefined),
}
```

**Empty states:**
- `idle`: "Pilih OLT atau ketik pencarian untuk memulai"
- `browsing` 0 hasil: "Tidak ada ONU pada scope ini"
- `searching` 0 hasil: "Tidak ada ONU dengan kata kunci '{query}'"

### 5.2 Halaman Detail OLT — Section Cards

**File:** `app/admin/olt/devices/[id]/OltDeviceDetailClient.tsx` (extend) + `OltCardSection.tsx` (baru, di-import)

**Section "Cards":**
- Header: judul "Cards" + tombol "Sync Cards" (loading state inline, disabled selama sync)
- Subtitle dinamis berdasar vendor:
  - ZTE → "Sync via SNMP card table"
  - Lainnya → "Pizza-box, 1 card BUILTIN otomatis"
- Tabel (`ResponsiveTable`):
  - Kolom: Frame, Slot, Type, PON Count, Status, ONU Count, Aksi (Edit)
  - Empty: "Belum ada data card. Klik 'Sync Cards' untuk mulai."

**Modal/inline edit:**
- Field editable: `cardType` (string), `ponCount` (1..64), `status` (enum)
- Field non-editable: `slotFrame`, `slot`
- Submit → `PATCH /api/olt/devices/[id]/cards/[cardId]` → reload list

**Permission gating:**
- Tabel Cards: `olt_card:read`
- Tombol Sync Cards: `olt_card:sync`
- Tombol Edit: `olt_card:write`

## 6. Data Flow

```
[A] /admin/olt/devices/[id]
    fetch device → fetch GET /api/olt/devices/[id]/cards → render OltCardSection

[B] Klik "Sync Cards"
    POST /api/olt/devices/[id]/cards/sync
    → OltCardService.syncCards
       → validate prereqs
       → branch by vendor (ZTE: discoverCards via SNMP / lainnya: seed BUILTIN)
       → upsertByPosition per card
    → return { synced, mode }
    → UI reload list

[C] /admin/olt/onu (idle)
    fetch dropdown OLT → render empty state

[D] Pilih OLT X (browsing)
    fetch GET /api/olt/devices/X/cards (untuk dropdown card)
    fetch GET /api/olt/onu?oltId=X&page=1&limit=20
    render tabel

[E] Pilih Card Y → PON 3
    fetch GET /api/olt/onu?oltId=X&slotFrame=...&slot=...&ponPort=3
    tabel re-render

[F] Ketik di search bar
    debounce 300ms
    mode = 'searching'; grey-out scope
    fetch GET /api/olt/onu?search=ABC&status=...
    server abaikan oltId/slot/ponPort
    tabel re-render dengan badge "Pencarian global"

[G] Hapus search
    mode = 'browsing'; state scope sebelumnya kembali aktif
    re-fetch dengan parameter scope
```

## 7. Error Handling

**API layer (semua endpoint baru):**
- 401 unauthorized (no session)
- 403 forbidden (no permission)
- 400 bad request (Zod validation)
- 404 not found (resource tidak ada / tenant mismatch)
- 502 bad gateway (adapter / SNMP error)
- 500 internal (unexpected)

**Service layer:** `Result<T, OltCardError>` dengan error codes:
- `OLT_NOT_FOUND` → 404
- `CARD_NOT_FOUND` → 404
- `INVALID_CONFIG` → 400
- `SNMP_TIMEOUT` / `ADAPTER_ERROR` → 502
- `UNSUPPORTED_VENDOR` → 400 (guard)

**UI layer:**
- Fetch dibungkus try/catch + toast/banner
- Sync cards failure → banner inline di section, tabel card tetap tampil
- Search/scope failure → banner kecil, tabel render data lama

## 8. Edge Cases

| Skenario | Perilaku |
|---------|---------|
| OLT ZTE belum sync card | Dropdown card kosong dengan placeholder "Belum ada card. Sync di halaman OLT". List ONU tetap berfungsi (filter card di-skip server-side) |
| Hardware card dilepas | Sync ulang TIDAK menghapus row. Operator set `status='OFFLINE'` manual |
| ONU di slot yang tidak ada di tabel `OltCard` | Server tidak gagal. ONU yatim tidak muncul di flow cascading, tapi muncul di pencarian SN |
| Banner di halaman manajemen card | "X ONU di slot yang belum ter-discover" jika ada anomaly |
| ONU `ponPort` di luar `card.ponCount` | Tidak terlihat dari cascading filter, hanya via search |
| Search SN substring umum | Standar pagination 20/page + total count |
| Tenant isolation | `tenantId` dari session (anti-tamper), repository selalu filter by `tenantId` |
| Loading state cascading | Fetch card list dan fetch ONU jalan paralel; ONU fetch hanya butuh `oltId` |

## 9. Testing Strategy

### 9.1 Repository tests
File: `modules/olt/repositories/__tests__/olt-card.repository.test.ts`
- `upsertByPosition` insert/update idempotent
- `listByOlt` filter by tenant + olt, urutan slotFrame/slot ASC
- `listByOlt` dengan onuCount akurat

### 9.2 Service tests
File: `modules/olt/services/__tests__/olt-card.service.test.ts`
- `syncCards` ZTE happy path (mock adapter)
- `syncCards` ZTE adapter error
- `syncCards` HSGQ pizza-box (no adapter call, seed BUILTIN)
- `syncCards` invalid config (no SNMP community / no defaultSlot)
- `syncCards` idempotent (panggil 2x, hasil sama)
- `updateCard` validation (ponCount range, status enum)
- Tenant isolation

File: `modules/olt/services/__tests__/olt-onu.service.test.ts` (extend existing or create)
- `listOnus` dengan filter `oltId`, `slotFrame+slot`, `ponPort`
- `listOnus` dengan `search` saja: lintas OLT, OR-match SN/description/pelanggan.nama
- `listOnus` dengan `search + oltId`: server abaikan oltId
- `listOnus` dengan `search + status`: status tetap apply
- Pagination + total count akurat

### 9.3 API route tests
- `app/api/olt/devices/[id]/cards/__tests__/route.test.ts`
- `app/api/olt/devices/[id]/cards/sync/__tests__/route.test.ts`
- `app/api/olt/devices/[id]/cards/[cardId]/__tests__/route.test.ts`

Coverage: 401/403/400/404/200, tenant isolation.

### 9.4 Adapter test
File: `modules/olt/adapters/zte/__tests__/ZteAdapter.discoverCards.test.ts`
- Mock `ZteSnmpClient.walk`
- Walk return entries → parse benar
- Walk timeout → `SNMP_TIMEOUT`
- Status mapping ACTIVE/MAINTENANCE/OFFLINE

### 9.5 Coverage target
- Service & repository: ≥80%
- API routes: 100% jalur error path

## 10. Acceptance Criteria

1. Halaman `/admin/olt/onu` empty state saat tidak ada OLT terpilih dan search kosong
2. Pilih OLT chassis ZTE → dropdown Card terisi card hasil sync
3. Pilih Card → dropdown PON menampilkan 1..ponCount card itu
4. Pilih PON → list ONU ter-filter ke posisi tepat
5. Pilih OLT pizza-box → dropdown Card berisi 1 BUILTIN, dropdown PON 1..totalPonPorts
6. Mengetik di search bar → scope dropdown grey-out, hasil global lintas OLT
7. Hapus search → scope dropdown enabled lagi, state scope sebelumnya kembali aktif
8. Search OR-match SN, description, dan nama pelanggan
9. Halaman detail OLT menampilkan section Cards
10. Klik Sync Cards untuk OLT ZTE → SNMP walk → card list ter-update
11. Klik Sync Cards untuk OLT pizza-box → 1 card BUILTIN ter-seed
12. Edit card: ubah cardType/ponCount/status → tersimpan
13. Permission gating: user tanpa `olt_card:*` tidak bisa lihat/sync/edit
14. Tenant isolation: tenantA tidak bisa akses card tenantB
15. Tombol "Unregistered" dan "Pre-Register" di header tetap berfungsi
16. Filter status tetap berfungsi di mode browsing dan searching
17. `docs/CHANGELOG.md` ter-update dengan entry `[ADDED]` (OltCard module + UI cascading), `[CHANGED]` (OltOnuService extension, OltOnuListClient rewrite), dan `[MIGRATION]` (add olt_cards table)

## 11. Out of Scope (Future Work)

- MAC address sebagai field pencarian (butuh migrasi `OnuDevice.macAddress` + sync per-vendor adapter)
- Auto-prune card yang hilang dari hardware saat sync
- OID tambahan untuk `ponCount` per card ZTE (saat ini default 8, bisa direvisi)
- Halaman global "All Cards" lintas OLT
- CRUD manual card

## 12. Files Affected

**New:**
- `prisma/migrations/<timestamp>_add_olt_card_table/migration.sql`
- `modules/olt/domain/entities/olt-card.entity.ts`
- `modules/olt/repositories/olt-card.repository.ts`
- `modules/olt/services/olt-card.service.ts`
- `modules/olt/validators/olt-card.validator.ts`
- `modules/olt/adapters/zte/__tests__/ZteAdapter.discoverCards.test.ts`
- `modules/olt/repositories/__tests__/olt-card.repository.test.ts`
- `modules/olt/services/__tests__/olt-card.service.test.ts`
- `app/api/olt/devices/[id]/cards/route.ts`
- `app/api/olt/devices/[id]/cards/sync/route.ts`
- `app/api/olt/devices/[id]/cards/[cardId]/route.ts`
- `app/api/olt/devices/[id]/cards/__tests__/route.test.ts`
- `app/api/olt/devices/[id]/cards/sync/__tests__/route.test.ts`
- `app/api/olt/devices/[id]/cards/[cardId]/__tests__/route.test.ts`
- `app/admin/olt/devices/[id]/OltCardSection.tsx`

**Modified:**
- `prisma/schema.prisma` (add OltCard model + OltCardStatus enum)
- `modules/olt/index.ts` (export public API)
- `modules/olt/domain/ports/IOltAdapter.ts` (optional `discoverCards`)
- `modules/olt/adapters/zte/ZteAdapter.ts` (implement discoverCards)
- `modules/olt/config/oid-registry/zte.oid.ts` (tambah OID card table)
- `modules/olt/services/olt-onu.service.ts` (extend listOnus filter + search)
- `modules/olt/validators/olt-onu.validator.ts` (extend onuListQuerySchema)
- `app/api/olt/onu/route.ts` (parse param baru)
- `app/admin/olt/onu/OltOnuListClient.tsx` (rewrite)
- `app/admin/olt/devices/[id]/OltDeviceDetailClient.tsx` (import OltCardSection)
- `lib/permission-config.ts` (tambah olt_card:*)
- `docs/CHANGELOG.md` (entries [ADDED], [CHANGED], [MIGRATION])
