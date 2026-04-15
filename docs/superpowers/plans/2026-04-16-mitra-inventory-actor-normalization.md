# Mitra Inventory Actor Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuka kembali mutation dan history inventory mobile untuk Mitra dengan persistence actor-aware yang tetap kompatibel untuk flow user lama.

**Architecture:** Actor persistence dipindahkan ke source of truth generik `actorType` + `actorId`, sementara `userId` dan `assignedTo` legacy tetap dipertahankan hanya untuk flow actor `user`. Implementasi dibatasi ke schema Prisma, logger, repository inventory, mobile inventory routes, serta DTO/mapper asset minimum agar Mitra tidak lagi dipaksa menyamar sebagai `User`.

**Tech Stack:** Next.js 16, TypeScript, Prisma, PostgreSQL, Vitest, Expo/mobile inventory API

---

## File Map

### Schema dan persistence
- Modify: `prisma/schema.prisma`
  - Tambah field actor generic pada `BarangMasuk`, `BarangKeluar`, dan `Asset`
  - Pertahankan `userId` / `assignedTo` legacy untuk compatibility

### Logging
- Modify: `lib/logger.ts`
  - Tambah contract actor-aware untuk `logActivity`, `logAuth`, dan `logActivitySafe`

### Inventory repository
- Modify: `modules/inventory/repositories/IInventoryRepository.ts`
  - Tambah type actor kecil yang eksplisit
  - Update `CreateBarangMasukInput` dan `CreateBarangKeluarInput`
- Modify: `modules/inventory/repositories/InventoryRepository.ts`
  - Tulis `actorType`/`actorId` pada mutasi inventory
  - Tulis `assignedActorType`/`assignedActorId` pada asset assignment

### API mobile inventory
- Modify: `app/api/mobile/inventory/masuk/route.ts`
  - Gunakan repository actor-aware untuk user dan mitra
- Modify: `app/api/mobile/inventory/keluar/route.ts`
  - Gunakan repository actor-aware dan logger actor-aware
- Modify: `app/api/mobile/inventory/riwayat/route.ts`
  - Support read path transisional: row lama by `userId`, row baru by actor generic

### DTO dan mapper asset
- Modify: `modules/inventory/dto/AssetDTO.ts`
  - Tambah `assignedActor`
- Modify: `modules/inventory/mappers/AssetMapper.ts`
  - Map actor assignment generik tanpa memecah consumer lama

### Tests
- Modify: `tests/api/mobile-inventory-authorization.test.ts`
  - Ubah test Mitra dari fail-closed menjadi success path
- Modify: `tests/modules/inventory/InventoryRepository.test.ts`
  - Tambah test actor-aware create/remove stock
- Create: `tests/lib/logger.test.ts`
  - Tambah test actor-aware logging

---

### Task 1: Tambahkan schema actor-aware untuk inventory dan asset

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `npx prisma validate`

- [ ] **Step 1: Tulis perubahan schema yang gagal divalidasi bila field belum ada**

Tambahkan field berikut:

```prisma
model BarangKeluar {
  id        String   @id @default(uuid())
  barangId  String
  gudangId  String
  jumlah    Int
  kondisi   KondisiBarang @default(BARU)
  keterangan String?
  tujuanPenggunaan String?
  isHilang  Boolean @default(false)
  userId    String?
  actorType String?
  actorId   String?
  tanggal   DateTime @default(now())
  fotoBukti String[] @default([])
  fotoMetadata Json?
  tenantId  String?

  user      User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([actorType, actorId])
}

model BarangMasuk {
  id        String   @id @default(uuid())
  barangId  String
  gudangId  String
  jumlah    Int
  hargaBeliSatuan Decimal @default(0)
  kondisi   KondisiBarang @default(BARU)
  keterangan String?
  supplier  String?
  userId    String?
  actorType String?
  actorId   String?
  tanggal   DateTime @default(now())
  fotoBukti String[] @default([])
  fotoMetadata Json?
  tenantId  String?

  user      User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([actorType, actorId])
}

model Asset {
  id                String   @id @default(uuid())
  barangId          String
  kodeAsset         String
  purchaseDate      DateTime
  purchasePrice     Decimal  @db.Decimal(19, 2)
  currentValue      Decimal  @db.Decimal(19, 2)
  residualValue     Decimal  @default(0) @db.Decimal(19, 2)
  usefulLife        Int
  status            AssetStatus @default(ACTIVE)
  location          String?
  assignedTo        String?
  assignedActorType String?
  assignedActorId   String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  tenantId          String?

  user User? @relation(fields: [assignedTo], references: [id])

  @@index([assignedTo])
  @@index([assignedActorType, assignedActorId])
}
```

- [ ] **Step 2: Validasi schema**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx prisma validate`
Expected: PASS dengan output mengandung `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Generate Prisma client**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npm run prisma:generate`
Expected: PASS dan client tergenerate tanpa error type pada field baru

- [ ] **Step 4: Commit schema foundation**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add prisma/schema.prisma
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "feat: add actor-aware inventory persistence fields"
```

### Task 2: Jadikan logger actor-aware

**Files:**
- Modify: `lib/logger.ts`
- Create: `tests/lib/logger.test.ts`

- [ ] **Step 1: Tulis failing test untuk actor user dan mitra**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Logger, LogLevel } from '@/lib/logger'
import { prismaMock } from '../setup'

describe('Logger actor-aware persistence', () => {
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = new Logger(LogLevel.INFO)
  })

  it('menyimpan userId dan actor generic untuk user actor', async () => {
    prismaMock.systemLog.create.mockResolvedValueOnce({} as never)

    await logger.logActivity({
      action: 'CREATE',
      subject: 'Inventory Out',
      actor: { type: 'user', id: 'user-1', userId: 'user-1' },
      tenantId: 'tenant-1',
    })

    expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          actorType: 'user',
          actorId: 'user-1',
        }),
      }),
    )
  })

  it('menyimpan actor generic tanpa userId untuk mitra actor', async () => {
    prismaMock.systemLog.create.mockResolvedValueOnce({} as never)

    await logger.logActivity({
      action: 'CREATE',
      subject: 'Inventory Out',
      actor: { type: 'mitra', id: 'mitra-1' },
      tenantId: 'tenant-1',
    })

    expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          actorType: 'mitra',
          actorId: 'mitra-1',
        }),
      }),
    )
  })
})
```

- [ ] **Step 2: Run logger test untuk memastikan fail**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/lib/logger.test.ts`
Expected: FAIL karena `actor` belum ada di contract logger

- [ ] **Step 3: Implement minimal actor-aware logger**

Tambahkan helper kecil dan kontrak baru:

```ts
export type LoggerActor = {
  type: 'user' | 'mitra'
  id: string
  userId?: string
}

function normalizeActor(actor?: LoggerActor): {
  actorType: 'user' | 'mitra' | null
  actorId: string | null
  userId: string | null
} {
  if (!actor) {
    return { actorType: null, actorId: null, userId: null }
  }

  return {
    actorType: actor.type,
    actorId: actor.id,
    userId: actor.type === 'user' ? actor.userId ?? actor.id : null,
  }
}
```

Lalu pakai pada `logActivity`, `logAuth`, dan `logActivitySafe`:

```ts
const normalizedActor = normalizeActor(data.actor)

await prisma.systemLog.create({
  data: {
    id: randomUUID(),
    type: 'ACTIVITY',
    action: data.action,
    subject: data.subject,
    details: data.details ? JSON.stringify(data.details) : null,
    userId: normalizedActor.userId,
    actorType: normalizedActor.actorType,
    actorId: normalizedActor.actorId,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    tenantId: data.tenantId || null,
  },
})
```

- [ ] **Step 4: Run logger test untuk memastikan pass**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/lib/logger.test.ts`
Expected: PASS

- [ ] **Step 5: Commit logger actor-aware**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add lib/logger.ts tests/lib/logger.test.ts
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "feat: add actor-aware system logging"
```

### Task 3: Ubah kontrak repository inventory menjadi actor-aware

**Files:**
- Modify: `modules/inventory/repositories/IInventoryRepository.ts`
- Test: `tests/modules/inventory/InventoryRepository.test.ts`

- [ ] **Step 1: Tulis failing test untuk kontrak actor-aware add/remove stock**

Tambahkan shape expectation pada test repository:

```ts
const actor = { type: 'mitra' as const, id: 'mitra-1' }

await repository.addStock({
  barangId: 'barang-1',
  gudangId: 'gudang-1',
  jumlah: 2,
  actor,
})
```

Expected failure awal: property `actor` belum ada pada input type

- [ ] **Step 2: Update type contract**

```ts
export interface InventoryActorInput {
  type: 'user' | 'mitra'
  id: string
  userId?: string
}

export interface CreateBarangMasukInput {
  barangId: string
  gudangId: string
  jumlah: number
  hargaBeliSatuan?: number
  kondisi?: KondisiBarang
  keterangan?: string
  fotoBukti?: string[]
  fotoMetadata?: Record<string, unknown>
  actor: InventoryActorInput
  tanggal?: Date
  tenantId?: string
}

export interface CreateBarangKeluarInput {
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: KondisiBarang
  keterangan?: string
  tujuanPenggunaan?: string
  isHilang?: boolean
  actor: InventoryActorInput
  fotoBukti?: string[]
  fotoMetadata?: Record<string, unknown>
  tanggal?: Date
  tenantId?: string
}
```

- [ ] **Step 3: Run repository test target untuk memastikan fail pada implementasi**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/modules/inventory/InventoryRepository.test.ts`
Expected: FAIL di implementasi karena masih membaca `data.userId`

- [ ] **Step 4: Commit type contract**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add modules/inventory/repositories/IInventoryRepository.ts
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "refactor: make inventory repository inputs actor-aware"
```

### Task 4: Implement actor-aware write path di InventoryRepository

**Files:**
- Modify: `modules/inventory/repositories/InventoryRepository.ts`
- Modify: `tests/modules/inventory/InventoryRepository.test.ts`

- [ ] **Step 1: Tulis failing tests untuk add stock dan remove stock**

Tambahkan test berikut:

```ts
it('menulis actor generic dan legacy userId untuk add stock user', async () => {
  prismaMock.barang.findFirst.mockResolvedValueOnce({ id: 'barang-1' } as never)
  prismaMock.gudang.findFirst.mockResolvedValueOnce({ id: 'gudang-1' } as never)
  prismaMock.barangMasuk.create.mockResolvedValueOnce({ id: 'masuk-1', barang: null } as never)
  prismaMock.barangGudang.upsert.mockResolvedValueOnce({} as never)

  await repository.addStock({
    barangId: 'barang-1',
    gudangId: 'gudang-1',
    jumlah: 1,
    actor: { type: 'user', id: 'user-1', userId: 'user-1' },
    tenantId: 'tenant-1',
  })

  expect(prismaMock.barangMasuk.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        actorType: 'user',
        actorId: 'user-1',
      }),
    }),
  )
})

it('menulis actor generic tanpa userId untuk remove stock mitra', async () => {
  prismaMock.barangGudang.findUnique.mockResolvedValueOnce({
    id: 'bg-1',
    stok: 5,
    stokBaru: 5,
  } as never)
  prismaMock.barangGudang.updateMany.mockResolvedValueOnce({ count: 1 } as never)
  prismaMock.barangKeluar.create.mockResolvedValueOnce({
    id: 'keluar-1',
    barang: { jenis: 'ASET' },
    gudang: { nama: 'Gudang A' },
    keterangan: 'deploy',
  } as never)
  prismaMock.asset.findMany.mockResolvedValueOnce([{ id: 'asset-1' }] as never)
  prismaMock.asset.updateMany.mockResolvedValueOnce({ count: 1 } as never)

  await repository.removeStock({
    barangId: 'barang-1',
    gudangId: 'gudang-1',
    jumlah: 1,
    kondisi: 'BARU',
    actor: { type: 'mitra', id: 'mitra-1' },
  })

  expect(prismaMock.barangKeluar.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        userId: null,
        actorType: 'mitra',
        actorId: 'mitra-1',
      }),
    }),
  )

  expect(prismaMock.asset.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        assignedTo: null,
        assignedActorType: 'mitra',
        assignedActorId: 'mitra-1',
      }),
    }),
  )
})
```

- [ ] **Step 2: Run repository tests untuk memastikan fail**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/modules/inventory/InventoryRepository.test.ts`
Expected: FAIL karena repository belum menulis field actor generic

- [ ] **Step 3: Implement helper actor normalization di repository**

Tambahkan helper lokal kecil di `InventoryRepository.ts`:

```ts
function normalizeInventoryActor(actor: InventoryActorInput): {
  actorType: 'user' | 'mitra'
  actorId: string
  userId: string | null
} {
  return {
    actorType: actor.type,
    actorId: actor.id,
    userId: actor.type === 'user' ? actor.userId ?? actor.id : null,
  }
}
```

Pakai pada `addStockInTransaction`:

```ts
const actor = normalizeInventoryActor(data.actor)

const masuk = await tx.barangMasuk.create({
  data: {
    id: crypto.randomUUID(),
    barangId: data.barangId,
    gudangId: data.gudangId,
    jumlah: data.jumlah,
    hargaBeliSatuan: data.hargaBeliSatuan || 0,
    kondisi: data.kondisi || 'BARU',
    keterangan: data.keterangan || null,
    userId: actor.userId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    tanggal: data.tanggal || new Date(),
    fotoBukti: data.fotoBukti || [],
    fotoMetadata: (data.fotoMetadata as Prisma.InputJsonValue) || Prisma.JsonNull,
    tenantId: data.tenantId || null,
  },
  include: {
    barang: true,
    gudang: true,
    user: { select: { id: true, name: true } },
  },
})
```

Pakai pada `removeStock`:

```ts
const actor = normalizeInventoryActor(data.actor)

const keluar = await tx.barangKeluar.create({
  data: {
    id: crypto.randomUUID(),
    barangId: data.barangId,
    gudangId: data.gudangId,
    jumlah: jumlahInt,
    kondisi: data.kondisi || 'BARU',
    keterangan: data.keterangan || null,
    tujuanPenggunaan: data.tujuanPenggunaan || null,
    isHilang: data.isHilang || false,
    userId: actor.userId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    tanggal: data.tanggal || new Date(),
    fotoBukti: data.fotoBukti || [],
    fotoMetadata: (data.fotoMetadata as Prisma.InputJsonValue) || Prisma.JsonNull,
    tenantId: data.tenantId || null,
  },
  include: { barang: true, gudang: true },
})
```

Update asset assignment:

```ts
await tx.asset.updateMany({
  where: { id: { in: assetIds } },
  data: {
    status: 'INSTALLED',
    location: `Deployed (Ref: ${keluarWithRelations.keterangan || 'Barang Keluar'})`,
    assignedTo: actor.userId,
    assignedActorType: actor.actorType,
    assignedActorId: actor.actorId,
  },
})
```

- [ ] **Step 4: Run repository tests untuk memastikan pass**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/modules/inventory/InventoryRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit repository implementation**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add modules/inventory/repositories/InventoryRepository.ts tests/modules/inventory/InventoryRepository.test.ts
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "feat: persist inventory actors generically"
```

### Task 5: Tambah DTO dan mapper asset untuk actor generic

**Files:**
- Modify: `modules/inventory/dto/AssetDTO.ts`
- Modify: `modules/inventory/mappers/AssetMapper.ts`

- [ ] **Step 1: Tambah contract DTO baru**

```ts
assignedActor: {
  type: 'user' | 'mitra'
  id: string
  name: string | null
} | null
```

Masukkan ke `AssetDetailDTO` dan `AssetListItemDTO` bila diperlukan.

- [ ] **Step 2: Map actor generic tanpa memecah legacy field**

Tambahkan helper mapper:

```ts
private static mapAssignedActor(entity: AssetWithRelations): AssetDetailDTO['assignedActor'] {
  if (!entity.assignedActorType || !entity.assignedActorId) {
    return null
  }

  return {
    type: entity.assignedActorType as 'user' | 'mitra',
    id: entity.assignedActorId,
    name: entity.user?.name ?? null,
  }
}
```

Gunakan di `toDetail` sambil mempertahankan `assignedTo` lama.

- [ ] **Step 3: Run typecheck focused**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npm run typecheck`
Expected: PASS tanpa error DTO/mapper

- [ ] **Step 4: Commit DTO/mapper update**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add modules/inventory/dto/AssetDTO.ts modules/inventory/mappers/AssetMapper.ts
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "feat: expose generic asset assignment actor"
```

### Task 6: Buka kembali route mobile inventory untuk Mitra

**Files:**
- Modify: `app/api/mobile/inventory/masuk/route.ts`
- Modify: `app/api/mobile/inventory/keluar/route.ts`
- Modify: `app/api/mobile/inventory/riwayat/route.ts`
- Modify: `tests/api/mobile-inventory-authorization.test.ts`

- [ ] **Step 1: Tulis failing route tests untuk success path Mitra**

Tambahkan test berikut:

```ts
it('allows mitra inventory masuk when permission and site are valid', async () => {
  mockFns.getMobileAuthPayload.mockResolvedValue({
    id: 'mitra-1',
    tenantId: 'tenant-1',
    permissions: ['m_barang_masuk:create'],
  })
  mockFns.userFindFirst.mockResolvedValue(null)
  mockFns.mitraFindUnique.mockResolvedValue({ id: 'mitra-1', siteId: 'site-1' })
  mockFns.gudangFindFirst.mockResolvedValue({ id: 'g-1', tenantId: 'tenant-1', sites: [{ id: 'site-1' }] })

  const response = await postMasuk(new NextRequest('http://localhost/api/mobile/inventory/masuk', {
    method: 'POST',
    body: JSON.stringify({ barangId: 'b-1', gudangId: 'g-1', jumlah: 1 }),
    headers: { 'content-type': 'application/json' },
  }))

  expect(response.status).toBe(200)
})
```

Tambahkan pola serupa untuk `keluar` dan `riwayat`.

- [ ] **Step 2: Run mobile inventory authorization tests untuk memastikan fail**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/api/mobile-inventory-authorization.test.ts`
Expected: FAIL karena route masih fail-closed untuk Mitra

- [ ] **Step 3: Implement actor-aware route logic**

`masuk/route.ts`:

```ts
const actor = user
  ? { type: 'user' as const, id: user.id, userId: user.id }
  : { type: 'mitra' as const, id: mitra.id }

const inventoryRepository = new InventoryRepository()
const result = await inventoryRepository.addStock({
  barangId,
  gudangId,
  jumlah,
  kondisi: kondisi || 'BARU',
  keterangan,
  fotoBukti: fotoBukti || [],
  actor,
  tenantId,
  tanggal: new Date(),
})
```

`keluar/route.ts`:

```ts
const actor = user
  ? { type: 'user' as const, id: user.id, userId: user.id }
  : { type: 'mitra' as const, id: mitra.id }

const result = await inventoryRepository.removeStock({
  barangId,
  gudangId,
  jumlah,
  kondisi: kondisi || 'BARU',
  keterangan,
  tujuanPenggunaan,
  fotoBukti: fotoBukti || [],
  actor,
  tenantId,
  tanggal: new Date(),
})

await logger.logActivity({
  action: 'CREATE',
  subject: 'Inventory Out (Mobile)',
  actor,
  tenantId,
  details: { barangId, jumlah, gudangId },
})
```

`riwayat/route.ts` read path transisional:

```ts
const actorWhereMasuk = user
  ? { OR: [{ userId: user.id }, { actorType: 'user', actorId: user.id }] }
  : { actorType: 'mitra', actorId: mitra.id }

const actorWhereKeluar = user
  ? { OR: [{ userId: user.id }, { actorType: 'user', actorId: user.id }] }
  : { actorType: 'mitra', actorId: mitra.id }
```

Gabungkan dengan gudang/site filter yang sudah ada.

- [ ] **Step 4: Run route tests untuk memastikan pass**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/api/mobile-inventory-authorization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit mobile route reopen**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add app/api/mobile/inventory/masuk/route.ts app/api/mobile/inventory/keluar/route.ts app/api/mobile/inventory/riwayat/route.ts tests/api/mobile-inventory-authorization.test.ts
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "feat: reopen mobile inventory flows for mitra actors"
```

### Task 7: Jalankan verifikasi akhir batch

**Files:**
- Modify: jika ada fix kecil hasil verifikasi
- Test: seluruh target batch

- [ ] **Step 1: Run targeted test suite**

Run:

```bash
cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx vitest run tests/lib/logger.test.ts tests/modules/inventory/InventoryRepository.test.ts tests/api/mobile-inventory-authorization.test.ts
```

Expected: semua PASS

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run prisma validate**

Run: `cd "/Users/rohadimraja/Documents/radpro/netmanager" && npx prisma validate`
Expected: PASS

- [ ] **Step 4: Commit verification fixes bila ada**

```bash
git -C "/Users/rohadimraja/Documents/radpro/netmanager" add -u
git -C "/Users/rohadimraja/Documents/radpro/netmanager" commit -m "test: verify mitra inventory actor normalization"
```

---

## Self-Review

### Spec coverage
- Schema actor generic: dicakup Task 1
- Logger actor-aware: dicakup Task 2
- Contract repository actor-aware: dicakup Task 3
- Write path repository: dicakup Task 4
- DTO/mapper asset minimum: dicakup Task 5
- Reopen route mobile Mitra: dicakup Task 6
- Verification akhir: dicakup Task 7

### Placeholder scan
- Tidak ada `TODO`, `TBD`, atau referensi implisit “similar to previous task”
- Semua task menyebut file, code, command, dan expected result

### Type consistency
- Actor contract konsisten memakai `{ type, id, userId? }`
- Source of truth persistence konsisten memakai `actorType` + `actorId`
- Legacy compatibility konsisten memakai `userId` / `assignedTo` hanya untuk actor user
