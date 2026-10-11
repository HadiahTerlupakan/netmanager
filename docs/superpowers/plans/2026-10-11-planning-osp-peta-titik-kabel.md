# Peta Perencanaan OSP — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tim planning dapat menaruh titik ODP/ODC dan menarik jalur kabel di peta sebuah Planning OSP, lalu kebutuhan kabel dan splitter terhitung otomatis dan mengisi daftar material planning.

**Architecture:** Titik dan jalur rencana disimpan di tabel topologi yang sudah ada (`MappingNode`/`MappingEdge`) dengan penanda `isPlanned` + `planningId`, sehingga seluruh editor peta Leaflet terpakai apa adanya dan rencana bisa menyambung ke infrastruktur eksisting. Keterlihatan dijaga sebagai perilaku bawaan di tiga chokepoint pembacaan, bukan oleh disiplin pemanggil. Perhitungan material adalah fungsi murni yang hasilnya diterbitkan menjadi `PlanningItem`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL), Zod, Vitest, Leaflet + react-leaflet, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-11-planning-osp-peta-titik-kabel-design.md`

## Global Constraints

- Bahasa jawaban agen dan komentar kode baru: **Bahasa Indonesia** (CLAUDE.md).
- Setiap perubahan `prisma/schema.prisma` **wajib** disertai file migration dalam commit yang sama. `prisma db push` dilarang. Nama migration deskriptif.
- `docs/CHANGELOG.md` wajib diperbarui di bagian `[Unreleased]` sebelum task ditutup, mengikuti format baku.
- Business logic dilarang di `app/api/**` — route hanya parse + panggil service. Query Prisma hanya di repository.
- Authorization hanya lewat `createHandler({ permissions: [...] })` dari `@/lib/api`; service tidak memuat logika izin.
- Commit mengikuti Conventional Commits: `feat|fix|refactor|chore|docs|test|perf|security(scope): judul`.
- Setiap commit menutup dengan `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Rasio splitter memakai daftar yang sudah ada di `components/map/node-form-utils.ts:17` — ODC `1:2,1:4,1:8,1:16,1:32,1:64`; ODP `1:2,1:4,1:8,1:16,1:32`. **Tidak dipersempit.**
- `Planning.spareKabelPersen` divalidasi **0–100**, bawaan `0`.
- Jalankan `./scripts/setup-test-db.sh` sekali sebelum menjalankan tes.
- Suite penuh `npx vitest run` di repo ini rutin melaporkan "Hook timed out in 15000ms" pada beberapa berkas karena beban paralel. Bila `Tests N passed` tanpa angka `failed` tetapi `Test Files X failed`, itu timeout impor — ulangi berkas itu sendiri sebelum menyimpulkan ada regresi.

## Review Focus

- **Superadmin tanpa filter**: `buildMapWhere` saat ini mengembalikan `undefined` bila `isSuperAdmin` dan tidak ada filter. Bila penyaring `isPlanned` ditambahkan tanpa mengubah cabang itu, superadmin melihat seluruh node rencana di peta operasional. Diuji di Task 1.
- **Planning dihapus meninggalkan node yatim**: `onDelete: SetNull` membuat `planningId` kosong sementara `isPlanned` tetap `true` — node jadi tak terlihat di mana pun dan tak bisa dihapus lewat UI. Diuji di Task 6.
- **Regenerasi material setelah planning disetujui**: angka material berubah setelah `APPROVED` berarti yang disetujui direksi bukan yang dibeli. Diuji di Task 8.
- **Cadangan ekstrem**: persentase negatif, di atas 100, dan tepat 0 harus berperilaku terdefinisi; `0` wajib tidak mengubah angka sama sekali. Diuji di Task 3.
- **Tautan dengan koordinat sintaksis valid tapi mustahil**: `0,0` dan nilai di luar rentang harus ditolak, bukan diterima sebagai titik. Diuji di Task 4.

---

## Struktur berkas

**Baru:**

| Berkas | Tanggung jawab |
|---|---|
| `prisma/migrations/<ts>_add_planning_map_points/migration.sql` | perubahan skema |
| `lib/geo/tautan-peta.ts` | pengurai URL Google Maps → koordinat (murni) |
| `lib/geo/tautan-peta-pendek.ts` | penyelesai tautan pendek + penjaga SSRF |
| `modules/planning/domain/kebutuhan-material-osp.ts` | hitung kabel & splitter (murni) |
| `modules/planning/repositories/PlanningPetaRepository.ts` | baca/tulis node & edge rencana |
| `modules/planning/services/PlanningPetaService.ts` | aturan titik & jalur rencana |
| `modules/planning/services/PlanningMaterialService.ts` | terbitkan rekap → `PlanningItem` |
| `modules/planning/validators/planningPetaSchemas.ts` | skema Zod titik/jalur/cadangan |
| `modules/planning/dto/PlanningPetaDTO.ts` | DTO titik & jalur rencana |
| `app/api/planning/[id]/peta/titik/route.ts` | CRUD titik rencana |
| `app/api/planning/[id]/peta/jalur/route.ts` | CRUD jalur rencana |
| `app/api/planning/[id]/peta/material/route.ts` | terbitkan material |
| `app/api/planning/tautan-peta/uraikan/route.ts` | uraikan tautan |
| `app/admin/planning/[id]/peta/PlanningPetaTab.tsx` | tab peta |
| `app/admin/planning/[id]/peta/FormTitikRencana.tsx` | form titik (3 cara input) |
| `app/admin/planning/[id]/peta/PanelRingkasanMaterial.tsx` | ringkasan + cadangan |

**Diubah:**

| Berkas | Perubahan |
|---|---|
| `prisma/schema.prisma` | kolom baru (§5 spec) |
| `modules/map/utils/tenantContext.ts:39` | `buildMapWhere` selalu membatasi `isPlanned` |
| `modules/map/repositories/MappingRepository.ts:39` | `findAllEdges` membatasi `isPlanned` |
| `modules/network/repositories/MobileTopologyRepository.ts:17-22` | tiga query dibatasi `isPlanned` |
| `app/admin/planning/[id]/PlanningDetailClient.tsx` | tab Peta |
| `modules/planning/index.ts` | ekspor service & skema baru |
| `docs/CHANGELOG.md` | entri per task |

---

## Task 1: Skema + penyaring node rencana di chokepoint peta

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_planning_map_points/migration.sql`
- Modify: `modules/map/utils/tenantContext.ts:39-66`
- Modify: `modules/map/repositories/MappingRepository.ts:39-52`
- Test: `tests/modules/map/penyaring-node-rencana.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `MapListFilters.lingkup?: "nyata" | "rencana" | "semua"`; `buildMapWhere(ctx, filters)` yang **selalu** mengembalikan objek; kolom `MappingNode.isPlanned`, `MappingNode.planningId`, `MappingEdge.isPlanned`, `MappingEdge.planningId`, `PlanningItem.isAutoGenerated`, `PlanningItem.sourceKey`, `Planning.spareKabelPersen`, `PlanningDocument.nodeId`.

- [ ] **Step 1: Tambah kolom di schema.prisma**

Pada `model MappingNode` tambahkan:

```prisma
  planningId String?
  isPlanned  Boolean   @default(false)
  planning   Planning? @relation("planning_nodes", fields: [planningId], references: [id], onDelete: SetNull)
```

dan indeks `@@index([planningId])`, `@@index([isPlanned])`.

Pada `model MappingEdge` tambahkan blok yang sama dengan nama relasi `"planning_edges"` dan indeks yang sama.

Pada `model PlanningItem` tambahkan:

```prisma
  isAutoGenerated Boolean @default(false)
  sourceKey       String?
```

dan `@@index([planningId, isAutoGenerated])`.

Pada `model Planning` tambahkan:

```prisma
  spareKabelPersen Float @default(0)

  nodes MappingNode[] @relation("planning_nodes")
  edges MappingEdge[] @relation("planning_edges")
```

Pada `model PlanningDocument` tambahkan:

```prisma
  nodeId String?
  node   MappingNode? @relation(fields: [nodeId], references: [nodeId], onDelete: Cascade)
```

dan `@@index([nodeId])`. Tambahkan relasi balik `documents PlanningDocument[]` pada `MappingNode`.

- [ ] **Step 2: Buat migration**

```bash
npx prisma migrate dev --name add_planning_map_points
npm run prisma:generate
```

Buka file `prisma/migrations/<timestamp>_add_planning_map_points/migration.sql` dan pastikan hanya berisi `ALTER TABLE ... ADD COLUMN` dan `CREATE INDEX` — tidak ada `DROP`. Semua kolom baru nullable atau ber-default, jadi tidak ada data loss.

- [ ] **Step 3: Tulis tes yang gagal**

Buat `tests/modules/map/penyaring-node-rencana.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildMapWhere } from "@/modules/map/utils/tenantContext";

const TENANT = { tenantId: "tenant-1", isSuperAdmin: false };
const SUPERADMIN = { tenantId: null, isSuperAdmin: true };

describe("buildMapWhere — penyaring node rencana", () => {
  it("menyembunyikan node rencana secara bawaan", () => {
    expect(buildMapWhere(TENANT)).toMatchObject({
      tenantId: "tenant-1",
      isPlanned: false,
    });
  });

  it("tetap menyembunyikan node rencana untuk superadmin tanpa filter", () => {
    // Cabang ini dulu mengembalikan undefined sehingga tidak ada penyaring
    // sama sekali — superadmin akan melihat seluruh titik rencana di peta
    // operasional.
    expect(buildMapWhere(SUPERADMIN)).toEqual({ isPlanned: false });
  });

  it("menyembunyikan node rencana walau ada filter lain", () => {
    expect(buildMapWhere(TENANT, { type: "odp" })).toMatchObject({
      type: "odp",
      isPlanned: false,
    });
  });

  it("menampilkan hanya node rencana saat lingkup diminta eksplisit", () => {
    expect(buildMapWhere(TENANT, { lingkup: "rencana" })).toMatchObject({
      isPlanned: true,
    });
  });

  it("tidak membatasi isPlanned saat lingkup semua", () => {
    expect(buildMapWhere(TENANT, { lingkup: "semua" })).not.toHaveProperty(
      "isPlanned",
    );
  });
});
```

- [ ] **Step 4: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/map/penyaring-node-rencana.test.ts`
Expected: FAIL — `buildMapWhere(SUPERADMIN)` mengembalikan `undefined`.

- [ ] **Step 5: Ubah `buildMapWhere` agar selalu mengembalikan objek**

Ganti isi `modules/map/utils/tenantContext.ts` bagian `MapListFilters` dan `buildMapWhere`:

```ts
/** Lingkup keterlihatan node/jalur peta. */
export type LingkupPeta = "nyata" | "rencana" | "semua";

export interface MapListFilters {
  siteId?: string;
  type?: string;
  includeUnassignedSite?: boolean;
  /**
   * Bawaan `"nyata"`: hanya node yang benar-benar terpasang.
   *
   * Titik rencana OSP hidup di tabel yang sama dengan topologi nyata. Penyaring
   * ini sengaja bersifat bawaan, bukan tanggung jawab pemanggil, supaya lupa
   * menyaring tidak mungkin terjadi karena bentuknya — bukan karena disiplin.
   * Konsekuensi terburuk bila bocor: pelanggan disambungkan ke ODP yang
   * fisiknya belum ada.
   */
  lingkup?: LingkupPeta;
}

/** Batasan `isPlanned` untuk sebuah lingkup; `{}` berarti tanpa batasan. */
function batasanLingkup(lingkup: LingkupPeta = "nyata") {
  if (lingkup === "semua") return {};
  return { isPlanned: lingkup === "rencana" };
}

export function buildMapWhere(ctx: TenantContext, filters?: MapListFilters) {
  const tenantWhere = buildTenantWhere(ctx) ?? {};
  const lingkupWhere = batasanLingkup(filters?.lingkup);

  const siteWhere = filters?.siteId
    ? filters.includeUnassignedSite
      ? { OR: [{ siteId: filters.siteId }, { siteId: null }] }
      : { siteId: filters.siteId }
    : {};

  return {
    ...tenantWhere,
    ...lingkupWhere,
    ...siteWhere,
    ...(filters?.type ? { type: filters.type } : {}),
  };
}
```

Hapus tipe kembalian eksplisit yang lama (yang memuat `| undefined`) dan biarkan TypeScript menyimpulkannya.

- [ ] **Step 6: Terapkan batasan yang sama pada query edge**

Di `modules/map/repositories/MappingRepository.ts`, ubah `findAllEdges`:

```ts
  async findAllEdges(ctx: TenantContext, filters?: MapListFilters) {
    const tenantWhere = buildTenantWhere(ctx) ?? {};
    const lingkupWhere = batasanLingkupEdge(filters?.lingkup);
    const siteId = filters?.siteId;

    const records = await prisma.mappingEdge.findMany({
      where: {
        ...tenantWhere,
        ...lingkupWhere,
        ...(siteId
          ? { OR: [{ sourceNode: { siteId } }, { targetNode: { siteId } }] }
          : {}),
      },
      include: EDGE_INCLUDE,
    });
    return records.map((record) => MapMapper.toDomainEdge(record));
  }
```

Ekspor `batasanLingkupEdge` dari `modules/map/utils/tenantContext.ts` sebagai alias `batasanLingkup` (bentuknya identik untuk node dan edge) dan impor di repository.

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/modules/map/penyaring-node-rencana.test.ts`
Expected: PASS (5 tes)

- [ ] **Step 8: Pastikan tes peta yang sudah ada tidak rusak**

Run: `npx vitest run tests/modules/map tests/api/map 2>&1 | tail -20`
Expected: semua lulus. Bila ada tes yang menegaskan bentuk `where` lama (`undefined` untuk superadmin), perbarui ekspektasinya — perilaku barunya memang disengaja.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tanpa galat.

- [ ] **Step 10: Catat di changelog & commit**

Tambahkan entri `[MIGRATION]` di `[Unreleased]` pada `docs/CHANGELOG.md` dengan nama file migration-nya.

```bash
git add prisma/schema.prisma prisma/migrations modules/map docs/CHANGELOG.md tests/modules/map/penyaring-node-rencana.test.ts
git commit -m "feat(planning): kolom titik rencana peta dan penyaring bawaan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Tutup dua chokepoint sisanya

**Files:**
- Modify: `modules/network/repositories/MobileTopologyRepository.ts:11-23`
- Test: `tests/modules/network/topologi-mobile-tanpa-rencana.test.ts`
- Test: `tests/modules/map/odp-options-tanpa-rencana.test.ts`

**Interfaces:**
- Consumes: kolom `isPlanned` dari Task 1.
- Produces: jaminan bahwa topologi mobile dan dropdown ODP pelanggan bebas node rencana.

- [ ] **Step 1: Tulis tes yang gagal untuk topologi mobile**

Buat `tests/modules/network/topologi-mobile-tanpa-rencana.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prismaMock } from "../../setup";

import { MobileTopologyRepository } from "@/modules/network/repositories/MobileTopologyRepository";

describe("MobileTopologyRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.mappingNode.findMany.mockResolvedValue([] as never);
    prismaMock.mappingEdge.findMany.mockResolvedValue([] as never);
    prismaMock.mappingEdge.groupBy.mockResolvedValue([] as never);
    prismaMock.otb.findMany.mockResolvedValue([] as never);
    prismaMock.pelanggan.findMany.mockResolvedValue([] as never);
    prismaMock.kmzFile.findMany.mockResolvedValue([] as never);
  });

  it("tidak mengirim node rencana ke aplikasi mobile", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPlanned: false } }),
    );
  });

  it("tidak mengirim jalur rencana ke aplikasi mobile", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPlanned: false } }),
    );
  });

  it("tidak menghitung jalur rencana pada rekap jumlah edge", async () => {
    await new MobileTopologyRepository().getTopologyData("tenant-1");

    expect(prismaMock.mappingEdge.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPlanned: false } }),
    );
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/network/topologi-mobile-tanpa-rencana.test.ts`
Expected: FAIL — ketiga query dipanggil tanpa `where`.

- [ ] **Step 3: Tambahkan penyaring**

Di `modules/network/repositories/MobileTopologyRepository.ts`, ganti tiga pemanggilan:

```ts
        // Titik dan jalur rencana OSP hidup di tabel yang sama dengan topologi
        // nyata. Aplikasi mobile hanya boleh melihat yang sudah terpasang.
        prisma.mappingNode.findMany({ where: { isPlanned: false } }),
        prisma.mappingEdge.findMany({ where: { isPlanned: false } }),
        prisma.mappingEdge.groupBy({
          by: ["source"],
          where: { isPlanned: false },
          _count: { source: true },
        }),
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/modules/network/topologi-mobile-tanpa-rencana.test.ts`
Expected: PASS (3 tes)

- [ ] **Step 5: Tulis tes dropdown ODP pelanggan**

Buat `tests/modules/map/odp-options-tanpa-rencana.test.ts` yang memanggil `MappingService.getOdpOptions` dengan repository ter-mock, lalu menegaskan `findAllNodes` dipanggil dengan filter yang **tidak** memuat `lingkup: "rencana"` maupun `"semua"`:

```ts
import { describe, expect, it, vi } from "vitest";

import { MappingService } from "@/modules/map/services/MappingService";

describe("MappingService.getOdpOptions", () => {
  it("tidak pernah meminta lingkup rencana atau semua", async () => {
    const repo = {
      findAllNodes: vi.fn().mockResolvedValue([]),
    } as never;
    const service = new MappingService(repo);

    await service.getOdpOptions(
      { tenantId: "tenant-1", isSuperAdmin: false },
      undefined,
    );

    const filters = (repo as never as { findAllNodes: ReturnType<typeof vi.fn> })
      .findAllNodes.mock.calls[0][1];
    expect(filters?.lingkup).toBeUndefined();
  });
});
```

Sesuaikan tanda tangan `MappingService` dan `getOdpOptions` dengan yang sebenarnya di `modules/map/services/MappingService.ts:57` saat menulis tes ini — baca berkasnya dulu.

- [ ] **Step 6: Jalankan tes**

Run: `npx vitest run tests/modules/map/odp-options-tanpa-rencana.test.ts`
Expected: PASS tanpa perubahan kode — penyaring bawaan dari Task 1 sudah menanganinya. Tes ini mengunci perilakunya agar tidak berubah diam-diam.

- [ ] **Step 7: Uji mutasi**

Balikkan satu penyaring (hapus `where: { isPlanned: false }` pada `mappingNode.findMany`), jalankan tes topologi mobile, pastikan **merah**, lalu kembalikan.

- [ ] **Step 8: Changelog & commit**

```bash
git add modules/network docs/CHANGELOG.md tests/modules/network tests/modules/map
git commit -m "feat(planning): tutup jalur baca topologi mobile dan dropdown ODP dari node rencana

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Perhitungan kebutuhan material (fungsi murni)

**Files:**
- Create: `modules/planning/domain/kebutuhan-material-osp.ts`
- Test: `tests/modules/planning/kebutuhan-material-osp.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  interface TitikRencana { type: string; splitter: string | null }
  interface JalurRencana {
    fiberType: string | null;
    distance: number | null;
    sumber: { latitude: number | null; longitude: number | null };
    tujuan: { latitude: number | null; longitude: number | null };
    waypoints: Array<[number, number]>;
  }
  interface KebutuhanMaterialOsp {
    kabel: Array<{ jenisFiber: string; meterTerukur: number; meterDipesan: number }>;
    splitter: Array<{ rasio: string; jumlah: number }>;
    jumlahTitik: { odp: number; odc: number };
    spareKabelPersen: number;
  }
  function hitungKebutuhanMaterialOsp(
    titik: TitikRencana[],
    jalur: JalurRencana[],
    spareKabelPersen: number,
  ): KebutuhanMaterialOsp
  ```

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/modules/planning/kebutuhan-material-osp.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { hitungKebutuhanMaterialOsp } from "@/modules/planning/domain/kebutuhan-material-osp";

const TITIK_NOL = { latitude: 0, longitude: 0 };

function jalur(fiberType: string, distance: number | null) {
  return {
    fiberType,
    distance,
    sumber: TITIK_NOL,
    tujuan: TITIK_NOL,
    waypoints: [] as Array<[number, number]>,
  };
}

describe("hitungKebutuhanMaterialOsp", () => {
  it("menjumlahkan panjang kabel per jenis fiber", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [jalur("feeder", 300), jalur("feeder", 240), jalur("distribution", 120)],
      0,
    );

    expect(hasil.kabel).toEqual([
      { jenisFiber: "feeder", meterTerukur: 540, meterDipesan: 540 },
      { jenisFiber: "distribution", meterTerukur: 120, meterDipesan: 120 },
    ]);
  });

  it("cadangan 0 persen tidak mengubah angka sama sekali", () => {
    const hasil = hitungKebutuhanMaterialOsp([], [jalur("feeder", 333.3)], 0);

    expect(hasil.kabel[0].meterDipesan).toBe(hasil.kabel[0].meterTerukur);
  });

  it("menerapkan cadangan sekali di akhir, bukan per ruas", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [jalur("feeder", 100), jalur("feeder", 100)],
      10,
    );

    expect(hasil.kabel[0].meterTerukur).toBe(200);
    expect(hasil.kabel[0].meterDipesan).toBe(220);
  });

  it("membulatkan meter pesanan ke 0,1 agar bisa dipesan", () => {
    const hasil = hitungKebutuhanMaterialOsp([], [jalur("feeder", 333)], 7);

    expect(hasil.kabel[0].meterDipesan).toBe(356.3);
  });

  it("menolak cadangan negatif", () => {
    expect(() => hitungKebutuhanMaterialOsp([], [], -1)).toThrow(
      /cadangan kabel/i,
    );
  });

  it("menolak cadangan di atas 100 persen", () => {
    expect(() => hitungKebutuhanMaterialOsp([], [], 101)).toThrow(
      /cadangan kabel/i,
    );
  });

  it("menghitung jarak sendiri saat jalur belum punya distance", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [
        {
          fiberType: "feeder",
          distance: null,
          sumber: { latitude: -6.2, longitude: 106.8 },
          tujuan: { latitude: -6.201, longitude: 106.8 },
          waypoints: [],
        },
      ],
      0,
    );

    // ~111 m per 0,001 derajat lintang.
    expect(hasil.kabel[0].meterTerukur).toBeGreaterThan(100);
    expect(hasil.kabel[0].meterTerukur).toBeLessThan(125);
  });

  it("mengabaikan jalur tanpa distance dan tanpa koordinat lengkap", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [
        {
          fiberType: "feeder",
          distance: null,
          sumber: { latitude: null, longitude: null },
          tujuan: TITIK_NOL,
          waypoints: [],
        },
      ],
      0,
    );

    expect(hasil.kabel).toEqual([]);
  });

  it("mengelompokkan splitter per rasio", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [
        { type: "odp", splitter: "1:8" },
        { type: "odp", splitter: "1:8" },
        { type: "odc", splitter: "1:16" },
      ],
      [],
      0,
    );

    expect(hasil.splitter).toEqual([
      { rasio: "1:8", jumlah: 2 },
      { rasio: "1:16", jumlah: 1 },
    ]);
    expect(hasil.jumlahTitik).toEqual({ odp: 2, odc: 1 });
  });

  it("tidak mengarang rasio untuk titik yang splitternya kosong", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [{ type: "odp", splitter: null }],
      [],
      0,
    );

    expect(hasil.splitter).toEqual([]);
    expect(hasil.jumlahTitik.odp).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/planning/kebutuhan-material-osp.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasikan**

Buat `modules/planning/domain/kebutuhan-material-osp.ts`:

```ts
import { calculateHaversineDistance } from "@/lib/geo-utils";

/**
 * Kebutuhan material sebuah Planning OSP, dihitung dari titik dan jalur di
 * peta. Murni: tanpa Prisma, tanpa I/O.
 *
 * Angka di sini menjadi dasar anggaran yang naik ke persetujuan berjenjang,
 * jadi dibuat semudah mungkin diuji dan tidak memuat asumsi tersembunyi.
 */

export interface TitikRencana {
  type: string;
  splitter: string | null;
}

export interface KoordinatRencana {
  latitude: number | null;
  longitude: number | null;
}

export interface JalurRencana {
  fiberType: string | null;
  distance: number | null;
  sumber: KoordinatRencana;
  tujuan: KoordinatRencana;
  waypoints: Array<[number, number]>;
}

export interface KebutuhanMaterialOsp {
  kabel: Array<{
    jenisFiber: string;
    meterTerukur: number;
    meterDipesan: number;
  }>;
  splitter: Array<{ rasio: string; jumlah: number }>;
  jumlahTitik: { odp: number; odc: number };
  spareKabelPersen: number;
}

const JENIS_FIBER_TAK_DIKENAL = "lainnya";

function bulatkanSepersepuluh(nilai: number): number {
  return Math.round(nilai * 10) / 10;
}

/** Panjang satu jalur: dipakai `distance` bila ada, kalau tidak dihitung. */
function panjangJalur(jalur: JalurRencana): number | null {
  if (jalur.distance !== null) {
    return jalur.distance;
  }

  const { sumber, tujuan } = jalur;
  if (
    sumber.latitude === null ||
    sumber.longitude === null ||
    tujuan.latitude === null ||
    tujuan.longitude === null
  ) {
    return null;
  }

  const titik: Array<[number, number]> = [
    [sumber.latitude, sumber.longitude],
    ...jalur.waypoints,
    [tujuan.latitude, tujuan.longitude],
  ];

  let total = 0;
  for (let i = 0; i < titik.length - 1; i += 1) {
    total += calculateHaversineDistance(
      titik[i][0],
      titik[i][1],
      titik[i + 1][0],
      titik[i + 1][1],
    );
  }
  return bulatkanSepersepuluh(total);
}

function pastikanCadanganSah(spareKabelPersen: number): void {
  if (
    Number.isNaN(spareKabelPersen) ||
    spareKabelPersen < 0 ||
    spareKabelPersen > 100
  ) {
    throw new Error("Cadangan kabel harus antara 0 dan 100 persen");
  }
}

/** Hitung kebutuhan kabel dan splitter dari titik & jalur rencana. */
export function hitungKebutuhanMaterialOsp(
  titik: TitikRencana[],
  jalur: JalurRencana[],
  spareKabelPersen: number,
): KebutuhanMaterialOsp {
  pastikanCadanganSah(spareKabelPersen);

  const meterPerJenis = new Map<string, number>();
  for (const satuJalur of jalur) {
    const panjang = panjangJalur(satuJalur);
    if (panjang === null) {
      continue;
    }
    const jenis = satuJalur.fiberType ?? JENIS_FIBER_TAK_DIKENAL;
    meterPerJenis.set(jenis, (meterPerJenis.get(jenis) ?? 0) + panjang);
  }

  const pengali = 1 + spareKabelPersen / 100;
  const kabel = [...meterPerJenis.entries()].map(([jenisFiber, meter]) => {
    const meterTerukur = bulatkanSepersepuluh(meter);
    return {
      jenisFiber,
      meterTerukur,
      meterDipesan: bulatkanSepersepuluh(meterTerukur * pengali),
    };
  });

  const jumlahPerRasio = new Map<string, number>();
  const jumlahTitik = { odp: 0, odc: 0 };
  for (const satuTitik of titik) {
    if (satuTitik.type === "odp") jumlahTitik.odp += 1;
    if (satuTitik.type === "odc") jumlahTitik.odc += 1;

    if (!satuTitik.splitter) {
      continue;
    }
    jumlahPerRasio.set(
      satuTitik.splitter,
      (jumlahPerRasio.get(satuTitik.splitter) ?? 0) + 1,
    );
  }

  return {
    kabel,
    splitter: [...jumlahPerRasio.entries()].map(([rasio, jumlah]) => ({
      rasio,
      jumlah,
    })),
    jumlahTitik,
    spareKabelPersen,
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/modules/planning/kebutuhan-material-osp.test.ts`
Expected: PASS (10 tes)

- [ ] **Step 5: Pastikan `calculateHaversineDistance` mengembalikan meter**

Baca `lib/geo-utils.ts`. Bila satuannya kilometer, kalikan 1000 di `panjangJalur` dan sesuaikan tes jarak. Jangan menebak — periksa.

- [ ] **Step 6: Uji mutasi**

Ubah `const pengali = 1 + spareKabelPersen / 100;` menjadi `const pengali = 1;`, jalankan tes, pastikan **merah**, kembalikan.

- [ ] **Step 7: Changelog & commit**

```bash
git add modules/planning/domain/kebutuhan-material-osp.ts tests/modules/planning/kebutuhan-material-osp.test.ts docs/CHANGELOG.md
git commit -m "feat(planning): perhitungan kebutuhan kabel dan splitter OSP

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Pengurai tautan Google Maps (murni)

**Files:**
- Create: `lib/geo/tautan-peta.ts`
- Test: `tests/lib/geo/tautan-peta.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  type HasilUraiTautan =
    | { status: "berhasil"; latitude: number; longitude: number }
    | { status: "butuh_resolusi"; url: string }
    | { status: "gagal"; alasan: string };
  function uraikanTautanPeta(teks: string): HasilUraiTautan
  const HOST_PETA_DIIZINKAN: readonly string[]
  ```

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/lib/geo/tautan-peta.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { uraikanTautanPeta } from "@/lib/geo/tautan-peta";

describe("uraikanTautanPeta", () => {
  it("membaca parameter q", () => {
    expect(uraikanTautanPeta("https://www.google.com/maps?q=-6.2,106.8")).toEqual(
      { status: "berhasil", latitude: -6.2, longitude: 106.8 },
    );
  });

  it("membaca parameter query pada search api", () => {
    expect(
      uraikanTautanPeta(
        "https://www.google.com/maps/search/?api=1&query=-6.2,106.8",
      ),
    ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
  });

  it("membaca koordinat kamera setelah @", () => {
    expect(
      uraikanTautanPeta("https://www.google.com/maps/@-6.2,106.8,17z"),
    ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
  });

  it("mendahulukan koordinat tempat !3d!4d daripada posisi kamera @", () => {
    // @ adalah posisi kamera; !3d/!4d adalah titik tempatnya.
    expect(
      uraikanTautanPeta(
        "https://www.google.com/maps/place/Toko/@-6.1,106.7,17z/data=!3m1!4b1!3d-6.25!4d106.85",
      ),
    ).toEqual({ status: "berhasil", latitude: -6.25, longitude: 106.85 });
  });

  it("meminta resolusi untuk tautan pendek", () => {
    expect(uraikanTautanPeta("https://maps.app.goo.gl/abc123")).toEqual({
      status: "butuh_resolusi",
      url: "https://maps.app.goo.gl/abc123",
    });
  });

  it("meminta resolusi untuk goo.gl/maps", () => {
    expect(uraikanTautanPeta("https://goo.gl/maps/abc123").status).toBe(
      "butuh_resolusi",
    );
  });

  it("menolak koordinat di luar rentang", () => {
    expect(
      uraikanTautanPeta("https://www.google.com/maps?q=-91,200").status,
    ).toBe("gagal");
  });

  it("menolak titik nol derajat yang hampir selalu salah tempel", () => {
    expect(uraikanTautanPeta("https://www.google.com/maps?q=0,0").status).toBe(
      "gagal",
    );
  });

  it("menolak host di luar Google", () => {
    expect(
      uraikanTautanPeta("https://contoh.test/maps?q=-6.2,106.8").status,
    ).toBe("gagal");
  });

  it("menolak teks yang bukan URL", () => {
    expect(uraikanTautanPeta("bukan tautan").status).toBe("gagal");
  });

  it("menolak string kosong", () => {
    expect(uraikanTautanPeta("   ").status).toBe("gagal");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/geo/tautan-peta.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasikan**

Buat `lib/geo/tautan-peta.ts`:

```ts
/**
 * Pengurai tautan Google Maps menjadi koordinat.
 *
 * Murni dan tanpa jaringan. Tautan pendek (`maps.app.goo.gl`, `goo.gl/maps`)
 * tidak memuat koordinat sama sekali — untuk itu fungsi ini mengembalikan
 * `butuh_resolusi`, dan pemanggil memutuskan apakah mau menukarnya lewat
 * jaringan (lihat `lib/geo/tautan-peta-pendek.ts`).
 */

export const HOST_PETA_DIIZINKAN = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
] as const;

const HOST_TAUTAN_PENDEK = ["maps.app.goo.gl", "goo.gl"];

export type HasilUraiTautan =
  | { status: "berhasil"; latitude: number; longitude: number }
  | { status: "butuh_resolusi"; url: string }
  | { status: "gagal"; alasan: string };

function gagal(alasan: string): HasilUraiTautan {
  return { status: "gagal", alasan };
}

/**
 * Titik nol derajat berada di Samudra Atlantik dan secara praktis selalu
 * berarti tempelan yang gagal, bukan lokasi sungguhan.
 */
function koordinatMasukAkal(latitude: number, longitude: number): boolean {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

function dariPasangan(teks: string | null): HasilUraiTautan | null {
  if (!teks) return null;
  const cocok = teks.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!cocok) return null;
  const latitude = Number(cocok[1]);
  const longitude = Number(cocok[2]);
  if (!koordinatMasukAkal(latitude, longitude)) {
    return gagal("Koordinat di luar rentang yang masuk akal");
  }
  return { status: "berhasil", latitude, longitude };
}

/** Urai tautan Google Maps menjadi koordinat, tanpa menyentuh jaringan. */
export function uraikanTautanPeta(teks: string): HasilUraiTautan {
  const bersih = teks.trim();
  if (!bersih) return gagal("Tautan kosong");

  let url: URL;
  try {
    url = new URL(bersih);
  } catch {
    return gagal("Bukan tautan yang sah");
  }

  if (!HOST_PETA_DIIZINKAN.includes(url.hostname as never)) {
    return gagal("Tautan bukan dari Google Maps");
  }

  if (HOST_TAUTAN_PENDEK.includes(url.hostname)) {
    return { status: "butuh_resolusi", url: url.toString() };
  }

  // `!3d`/`!4d` adalah koordinat tempatnya; `@` hanya posisi kamera. Yang
  // pertama lebih tepat, jadi didahulukan.
  const tempat = url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (tempat) {
    const hasil = dariPasangan(`${tempat[1]},${tempat[2]}`);
    if (hasil) return hasil;
  }

  const dariQuery =
    dariPasangan(url.searchParams.get("q")) ??
    dariPasangan(url.searchParams.get("query"));
  if (dariQuery) return dariQuery;

  const kamera = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (kamera) {
    const hasil = dariPasangan(`${kamera[1]},${kamera[2]}`);
    if (hasil) return hasil;
  }

  return gagal("Tautan tidak memuat koordinat");
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/geo/tautan-peta.test.ts`
Expected: PASS (11 tes)

- [ ] **Step 5: Commit**

```bash
git add lib/geo/tautan-peta.ts tests/lib/geo/tautan-peta.test.ts
git commit -m "feat(geo): pengurai tautan Google Maps menjadi koordinat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Penyelesai tautan pendek dengan penjaga SSRF

**Files:**
- Create: `lib/geo/tautan-peta-pendek.ts`
- Create: `app/api/planning/tautan-peta/uraikan/route.ts`
- Test: `tests/lib/geo/tautan-peta-pendek.test.ts`
- Test: `tests/api/planning-tautan-peta-route.test.ts`

**Interfaces:**
- Consumes: `uraikanTautanPeta`, `HOST_PETA_DIIZINKAN` dari Task 4.
- Produces: `selesaikanTautanPendek(url: string, ambil?: typeof fetch): Promise<HasilUraiTautan>`; endpoint `POST /api/planning/tautan-peta/uraikan` dengan body `{ tautan: string }`.

- [ ] **Step 1: Tulis tes penjaga yang gagal**

Buat `tests/lib/geo/tautan-peta-pendek.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { selesaikanTautanPendek } from "@/lib/geo/tautan-peta-pendek";

function responsPengalihan(lokasi: string) {
  return new Response(null, { status: 302, headers: { location: lokasi } });
}

describe("selesaikanTautanPendek", () => {
  it("mengambil koordinat dari tautan panjang hasil pengalihan", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(
        responsPengalihan("https://www.google.com/maps?q=-6.2,106.8"),
      );

    await expect(
      selesaikanTautanPendek("https://maps.app.goo.gl/abc", ambil),
    ).resolves.toEqual({
      status: "berhasil",
      latitude: -6.2,
      longitude: 106.8,
    });
  });

  it("menolak pengalihan yang berpindah ke host di luar daftar", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("https://penyerang.test/apa"));

    const hasil = await selesaikanTautanPendek(
      "https://maps.app.goo.gl/abc",
      ambil,
    );

    expect(hasil.status).toBe("gagal");
  });

  it("menolak pengalihan ke alamat internal", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("http://169.254.169.254/latest"));

    expect(
      (await selesaikanTautanPendek("https://maps.app.goo.gl/abc", ambil))
        .status,
    ).toBe("gagal");
  });

  it("menolak localhost", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("http://127.0.0.1:3000/admin"));

    expect(
      (await selesaikanTautanPendek("https://maps.app.goo.gl/abc", ambil))
        .status,
    ).toBe("gagal");
  });

  it("berhenti setelah batas pengalihan terlampaui", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(responsPengalihan("https://goo.gl/maps/lagi"));

    const hasil = await selesaikanTautanPendek(
      "https://maps.app.goo.gl/abc",
      ambil,
    );

    expect(hasil.status).toBe("gagal");
    expect(ambil.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("menolak tautan awal yang bukan host Google", async () => {
    const ambil = vi.fn();

    expect(
      (await selesaikanTautanPendek("https://penyerang.test/x", ambil)).status,
    ).toBe("gagal");
    expect(ambil).not.toHaveBeenCalled();
  });

  it("tidak mengirim kredensial", async () => {
    const ambil = vi
      .fn()
      .mockResolvedValue(
        responsPengalihan("https://www.google.com/maps?q=-6.2,106.8"),
      );

    await selesaikanTautanPendek("https://maps.app.goo.gl/abc", ambil);

    const opsi = ambil.mock.calls[0][1];
    expect(opsi.redirect).toBe("manual");
    expect(opsi.credentials).toBe("omit");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/geo/tautan-peta-pendek.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasikan penyelesai**

Buat `lib/geo/tautan-peta-pendek.ts`:

```ts
import {
  HOST_PETA_DIIZINKAN,
  uraikanTautanPeta,
  type HasilUraiTautan,
} from "./tautan-peta";

/**
 * Menukar tautan pendek Google Maps menjadi tautan panjang yang memuat
 * koordinat.
 *
 * Ini satu-satunya tempat di alur ini yang mengirim permintaan keluar
 * berdasarkan teks yang diketik pengguna, jadi penjaganya ketat sejak awal:
 * daftar host tertutup yang diperiksa ulang **di setiap langkah pengalihan**
 * (bukan sekali di awal), batas jumlah pengalihan dan waktu, penolakan alamat
 * internal, tanpa kredensial, dan hanya header `location` yang dibaca —
 * badan responsnya tidak pernah diambil.
 */

const BATAS_PENGALIHAN = 3;
const BATAS_WAKTU_MS = 5000;

const POLA_ALAMAT_INTERNAL = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
];

function alamatInternal(hostname: string): boolean {
  return POLA_ALAMAT_INTERNAL.some((pola) => pola.test(hostname));
}

function hostDiizinkan(url: URL): boolean {
  if (alamatInternal(url.hostname)) return false;
  return HOST_PETA_DIIZINKAN.includes(url.hostname as never);
}

function gagal(): HasilUraiTautan {
  // Pesan sengaja umum: jangan bocorkan alamat internal atau galat jaringan
  // mentah ke klien.
  return {
    status: "gagal",
    alasan:
      "Tautan tidak dapat dibuka. Buka tautannya di browser, lalu salin koordinatnya.",
  };
}

/** Selesaikan tautan pendek menjadi koordinat. `ambil` dapat diinjeksi untuk tes. */
export async function selesaikanTautanPendek(
  url: string,
  ambil: typeof fetch = fetch,
): Promise<HasilUraiTautan> {
  let sekarang: URL;
  try {
    sekarang = new URL(url);
  } catch {
    return gagal();
  }

  for (let langkah = 0; langkah < BATAS_PENGALIHAN; langkah += 1) {
    if (!hostDiizinkan(sekarang)) {
      return gagal();
    }

    const pembatal = AbortSignal.timeout(BATAS_WAKTU_MS);
    let respons: Response;
    try {
      respons = await ambil(sekarang.toString(), {
        method: "HEAD",
        redirect: "manual",
        credentials: "omit",
        signal: pembatal,
      });
    } catch {
      return gagal();
    }

    const lokasi = respons.headers.get("location");
    if (!lokasi) {
      return gagal();
    }

    let berikutnya: URL;
    try {
      berikutnya = new URL(lokasi, sekarang);
    } catch {
      return gagal();
    }

    if (!hostDiizinkan(berikutnya)) {
      return gagal();
    }

    const hasil = uraikanTautanPeta(berikutnya.toString());
    if (hasil.status === "berhasil") {
      return hasil;
    }
    if (hasil.status === "gagal") {
      return gagal();
    }

    sekarang = berikutnya;
  }

  return gagal();
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/geo/tautan-peta-pendek.test.ts`
Expected: PASS (7 tes)

- [ ] **Step 5: Buat endpoint**

Buat `app/api/planning/tautan-peta/uraikan/route.ts`:

```ts
import { z } from "zod";

import { createHandler, apiSuccess } from "@/lib/api";
import { uraikanTautanPeta } from "@/lib/geo/tautan-peta";
import { selesaikanTautanPendek } from "@/lib/geo/tautan-peta-pendek";

const skemaUraiTautan = z.object({
  tautan: z.string().min(1, "Tautan wajib diisi").max(2048, "Tautan terlalu panjang"),
});

/**
 * POST /api/planning/tautan-peta/uraikan
 *
 * Mengubah tautan Google Maps menjadi koordinat. Tautan panjang diurai tanpa
 * jaringan; hanya tautan pendek yang memicu satu permintaan keluar, dengan
 * penjaga di `lib/geo/tautan-peta-pendek.ts`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: skemaUraiTautan,
  },
  async (_req, ctx) => {
    const awal = uraikanTautanPeta(ctx.validated.tautan);
    if (awal.status !== "butuh_resolusi") {
      return apiSuccess(awal);
    }
    return apiSuccess(await selesaikanTautanPendek(awal.url));
  },
);
```

- [ ] **Step 6: Tulis tes route**

Buat `tests/api/planning-tautan-peta-route.test.ts` yang memastikan: tautan panjang dijawab 200 tanpa memanggil `fetch`; pengguna tanpa `planning:update` ditolak 403. Ikuti pola mock di `tests/api/announcements-route.test.ts` (`vi.hoisted` + `vi.mock("@/lib/rbac")`).

- [ ] **Step 7: Jalankan tes route**

Run: `npx vitest run tests/api/planning-tautan-peta-route.test.ts`
Expected: PASS

- [ ] **Step 8: Uji mutasi**

Hapus pemeriksaan `hostDiizinkan(berikutnya)` setelah pengalihan, jalankan tes, pastikan tes "berpindah ke host di luar daftar" **merah**, kembalikan.

- [ ] **Step 9: Changelog & commit**

```bash
git add lib/geo app/api/planning/tautan-peta tests/lib/geo tests/api/planning-tautan-peta-route.test.ts docs/CHANGELOG.md
git commit -m "feat(planning): uraikan tautan Google Maps termasuk tautan pendek

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Repository & service titik/jalur rencana

**Files:**
- Create: `modules/planning/repositories/PlanningPetaRepository.ts`
- Create: `modules/planning/services/PlanningPetaService.ts`
- Create: `modules/planning/validators/planningPetaSchemas.ts`
- Create: `modules/planning/dto/PlanningPetaDTO.ts`
- Create: `app/api/planning/[id]/peta/titik/route.ts`
- Create: `app/api/planning/[id]/peta/jalur/route.ts`
- Modify: `modules/planning/index.ts`
- Test: `tests/modules/planning/PlanningPetaService.test.ts`

**Interfaces:**
- Consumes: kolom dari Task 1; `PlanningNotFoundError`, `PlanningInvalidStateError` dari `modules/planning/errors/planning-errors`.
- Produces — service:
  ```ts
  planningPetaService.tambahTitik(planningId: string, input: BuatTitikRencanaInput, userId: string, tenantId: string): Promise<TitikRencanaDTO>
  planningPetaService.ubahTitik(planningId: string, nodeId: string, input: BuatTitikRencanaInput, userId: string, tenantId: string): Promise<TitikRencanaDTO>
  planningPetaService.hapusTitik(planningId: string, nodeId: string, userId: string, tenantId: string): Promise<void>
  planningPetaService.tambahJalur(planningId: string, input: BuatJalurRencanaInput, userId: string, tenantId: string): Promise<JalurRencanaDTO>
  planningPetaService.hapusJalur(planningId: string, edgeId: string, userId: string, tenantId: string): Promise<void>
  planningPetaService.ambilPeta(planningId: string, tenantId: string): Promise<{ titik: TitikRencanaDTO[]; jalur: JalurRencanaDTO[] }>
  planningPetaService.ambilTitikYatim(tenantId: string): Promise<TitikRencanaDTO[]>
  ```
- Produces — repository (`PlanningPetaRepository`):
  ```ts
  buatTitik(data: { planningId: string; tenantId: string; type: string; name: string; latitude: number; longitude: number; splitter: string; notes: string | null }): Promise<MappingNode>
  ubahTitik(nodeId: string, data: Partial<...>): Promise<MappingNode>
  hapusTitik(nodeId: string): Promise<void>
  ambilTitik(nodeId: string): Promise<MappingNode | null>
  ambilTitikPerPlanning(planningId: string): Promise<MappingNode[]>
  ambilTitikYatim(tenantId: string): Promise<MappingNode[]>   // isPlanned true, planningId null
  buatJalur(data: { planningId: string; tenantId: string; source: string; target: string; fiberType: string; waypoints: string | null; distance: number | null; notes: string | null }): Promise<MappingEdge>
  hapusJalur(edgeId: string): Promise<void>
  ambilJalurPerPlanning(planningId: string): Promise<MappingEdge[]>
  ```
  `tandaiTerbit` **tidak** dibuat di task ini — ia ditambahkan ke repository yang sama oleh Task 10.
- Produces — validator: `buatTitikRencanaSchema`, `buatJalurRencanaSchema`, `ubahCadanganKabelSchema`, konstanta `RASIO_SPLITTER_ODC`, `RASIO_SPLITTER_ODP`.

- [ ] **Step 1: Tulis skema validasi**

Buat `modules/planning/validators/planningPetaSchemas.ts`:

```ts
import { z } from "zod";

/** Rasio splitter yang sah; disalin dari components/map/node-form-utils.ts. */
export const RASIO_SPLITTER_ODC = [
  "1:2",
  "1:4",
  "1:8",
  "1:16",
  "1:32",
  "1:64",
] as const;
export const RASIO_SPLITTER_ODP = [
  "1:2",
  "1:4",
  "1:8",
  "1:16",
  "1:32",
] as const;

const latitudeSchema = z
  .number()
  .min(-90, "Latitude di luar rentang")
  .max(90, "Latitude di luar rentang");
const longitudeSchema = z
  .number()
  .min(-180, "Longitude di luar rentang")
  .max(180, "Longitude di luar rentang");

/**
 * Rasio splitter wajib diisi dan tidak punya nilai bawaan.
 *
 * Form peta operasional memilihkan `1:8` otomatis. Di dokumen anggaran, field
 * yang tidak pernah disentuh perencana akan diam-diam menjadi jumlah barang
 * yang dibeli — jadi di sini pilihan harus eksplisit.
 */
export const buatTitikRencanaSchema = z
  .object({
    type: z.enum(["odp", "odc"]),
    name: z.string().min(1, "Nama titik wajib diisi").max(120),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    splitter: z.string().min(1, "Rasio splitter wajib dipilih"),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((nilai, ctx) => {
    const sah: readonly string[] =
      nilai.type === "odc" ? RASIO_SPLITTER_ODC : RASIO_SPLITTER_ODP;
    if (!sah.includes(nilai.splitter)) {
      ctx.addIssue({
        code: "custom",
        path: ["splitter"],
        message: `Rasio splitter untuk ${nilai.type.toUpperCase()} harus salah satu dari ${sah.join(", ")}`,
      });
    }
  });

export const buatJalurRencanaSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  fiberType: z.string().min(1).max(40),
  waypoints: z.array(z.tuple([latitudeSchema, longitudeSchema])).default([]),
  distance: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const ubahCadanganKabelSchema = z.object({
  spareKabelPersen: z
    .number()
    .min(0, "Cadangan kabel minimal 0 persen")
    .max(100, "Cadangan kabel maksimal 100 persen"),
});
```

- [ ] **Step 2: Tulis tes service yang gagal**

Buat `tests/modules/planning/PlanningPetaService.test.ts` dengan repository ter-mock. Kasus yang wajib ada:

```ts
it("menandai titik baru sebagai rencana dan menautkannya ke planning", async () => {
  await service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1");

  expect(repo.buatTitik).toHaveBeenCalledWith(
    expect.objectContaining({
      planningId: "plan-1",
      isPlanned: true,
      tenantId: "tenant-1",
    }),
  );
});

it("menolak menambah titik pada planning milik tenant lain", async () => {
  planningRepo.findById.mockResolvedValue({ id: "plan-1", tenantId: "lain" });

  await expect(
    service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningNotFoundError);
});

it("menolak mengubah peta planning yang sudah disetujui", async () => {
  planningRepo.findById.mockResolvedValue({
    id: "plan-1",
    tenantId: "tenant-1",
    status: "APPROVED",
  });

  await expect(
    service.tambahTitik("plan-1", masukanTitik, "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningInvalidStateError);
});

it("menolak menghapus titik yang bukan milik planning itu", async () => {
  repo.ambilTitik.mockResolvedValue({ nodeId: "n-1", planningId: "plan-lain" });

  await expect(
    service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningNotFoundError);
});

it("menolak menghapus titik yang sudah terbit menjadi node nyata", async () => {
  // Node yang sudah dibangun tidak boleh hilang hanya karena planning-nya
  // dirapikan.
  repo.ambilTitik.mockResolvedValue({
    nodeId: "n-1",
    planningId: "plan-1",
    isPlanned: false,
  });

  await expect(
    service.hapusTitik("plan-1", "n-1", "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningInvalidStateError);
});

it("mengembalikan titik rencana yatim agar tetap bisa dirapikan", async () => {
  // planningId null + isPlanned true terjadi bila planning induknya dihapus
  // (onDelete: SetNull). Tanpa jalur ini, node itu tidak terlihat di mana pun
  // dan tidak bisa dihapus lewat UI mana pun.
  repo.ambilTitikYatim.mockResolvedValue([{ nodeId: "n-yatim" }]);

  await expect(service.ambilTitikYatim("tenant-1")).resolves.toHaveLength(1);
});
```

Tulis juga `tambahJalur` yang menandai `isPlanned: true` dan `planningId`.

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/planning/PlanningPetaService.test.ts`
Expected: FAIL — service belum ada.

- [ ] **Step 4: Implementasikan repository**

Buat `modules/planning/repositories/PlanningPetaRepository.ts`. Query Prisma saja, tanpa aturan bisnis:

```ts
import { randomUUID } from "node:crypto";

import { prisma } from "@/modules/database";

/**
 * Akses data titik & jalur rencana sebuah Planning OSP.
 *
 * Keduanya hidup di tabel topologi yang sama dengan jaringan nyata, jadi
 * setiap penulisan di sini **wajib** menyetel `isPlanned: true`. Nilai bawaan
 * kolom itu `false` (demi keamanan data lama dan editor peta biasa), sehingga
 * jalur inilah satu-satunya yang boleh menandainya sebagai rencana.
 */
export class PlanningPetaRepository {
  buatTitik(data: {
    planningId: string;
    tenantId: string;
    type: string;
    name: string;
    latitude: number;
    longitude: number;
    splitter: string;
    notes: string | null;
  }) {
    return prisma.mappingNode.create({
      data: {
        nodeId: randomUUID(),
        ...data,
        isPlanned: true,
        capacity: 0,
        updatedAt: new Date(),
      },
    });
  }

  ubahTitik(
    nodeId: string,
    data: Partial<{
      name: string;
      latitude: number;
      longitude: number;
      splitter: string;
      notes: string | null;
    }>,
  ) {
    return prisma.mappingNode.update({ where: { nodeId }, data });
  }

  async hapusTitik(nodeId: string) {
    await prisma.mappingNode.delete({ where: { nodeId } });
  }

  ambilTitik(nodeId: string) {
    return prisma.mappingNode.findUnique({ where: { nodeId } });
  }

  ambilTitikPerPlanning(planningId: string) {
    return prisma.mappingNode.findMany({
      where: { planningId, isPlanned: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Titik rencana yang planning induknya sudah dihapus (`onDelete: SetNull`). */
  ambilTitikYatim(tenantId: string) {
    return prisma.mappingNode.findMany({
      where: { tenantId, isPlanned: true, planningId: null },
    });
  }

  buatJalur(data: {
    planningId: string;
    tenantId: string;
    source: string;
    target: string;
    fiberType: string;
    waypoints: string | null;
    distance: number | null;
    notes: string | null;
  }) {
    return prisma.mappingEdge.create({
      data: { ...data, isPlanned: true },
    });
  }

  async hapusJalur(edgeId: string) {
    await prisma.mappingEdge.delete({ where: { edgeId } });
  }

  ambilJalurPerPlanning(planningId: string) {
    return prisma.mappingEdge.findMany({
      where: { planningId, isPlanned: true },
    });
  }
}
```

Periksa `prisma/schema.prisma` untuk memastikan field wajib `MappingNode` yang belum disetel di atas (mis. `createdAt`/`updatedAt`) sesuai — sesuaikan bila berbeda.

- [ ] **Step 5: Implementasikan service**

`PlanningPetaService` memuat aturan: kepemilikan tenant (`findOwnedPlanning` seperti `PlanningItemService:46`), status planning harus dapat diubah (pakai aturan yang sama dengan item: hanya `BACKLOG`/`REJECTED`), penolakan titik milik planning lain, penolakan menghapus titik yang sudah terbit, dan penulisan audit lewat `PlanningAuditService` memakai `AuditAction.UPDATED`.

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/modules/planning/PlanningPetaService.test.ts`
Expected: PASS

- [ ] **Step 7: Buat route**

`app/api/planning/[id]/peta/titik/route.ts` dan `.../jalur/route.ts` memakai `createHandler` dengan `permissions: ["planning:read"]` untuk GET dan `["planning:update"]` untuk POST/PUT/DELETE, memanggil service, tanpa logika bisnis.

- [ ] **Step 8: Ekspor dari barrel**

Tambahkan `planningPetaService`, `buatTitikRencanaSchema`, `buatJalurRencanaSchema`, `ubahCadanganKabelSchema` ke `modules/planning/index.ts`.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint modules/planning app/api/planning
git add modules/planning app/api/planning tests/modules/planning docs/CHANGELOG.md
git commit -m "feat(planning): titik dan jalur rencana pada peta planning

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Foto sekitar per titik

**Files:**
- Modify: `modules/planning/services/PlanningDocumentService.ts` (baca dulu nama sebenarnya di `modules/planning/services/`)
- Modify: `app/api/planning/[id]/documents/route.ts`
- Test: `tests/modules/planning/foto-titik-rencana.test.ts`

**Interfaces:**
- Consumes: `PlanningDocument.nodeId` dari Task 1; `planningPetaService` dari Task 6.
- Produces: dokumen dengan `nodeId` terisi dan `category: "SURVEY_PHOTO"`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
it("menautkan foto survei ke titik rencananya", async () => {
  await service.upload("plan-1", { ...berkas, nodeId: "n-1" }, "user-1", "tenant-1");

  expect(repo.create).toHaveBeenCalledWith(
    expect.objectContaining({ nodeId: "n-1", category: "SURVEY_PHOTO" }),
  );
});

it("menolak menautkan foto ke titik milik planning lain", async () => {
  petaRepo.ambilTitik.mockResolvedValue({ nodeId: "n-1", planningId: "plan-lain" });

  await expect(
    service.upload("plan-1", { ...berkas, nodeId: "n-1" }, "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningNotFoundError);
});

it("tetap menerima dokumen tanpa nodeId sebagai lampiran proyek", async () => {
  await service.upload("plan-1", berkas, "user-1", "tenant-1");

  expect(repo.create).toHaveBeenCalledWith(
    expect.objectContaining({ nodeId: null }),
  );
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/planning/foto-titik-rencana.test.ts`

- [ ] **Step 3: Tambahkan `nodeId` opsional pada skema dokumen & service**

Validasi: bila `nodeId` ada, titik harus milik planning yang sama. Unggahnya tetap memakai `convertAndSaveImage` dari `lib/utils/image-upload.ts` seperti dokumen planning yang sudah ada — jangan membuat jalur unggah baru.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

- [ ] **Step 5: Changelog & commit**

```bash
git commit -m "feat(planning): foto survei melekat pada titik rencana

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Terbitkan rekap menjadi item material

**Files:**
- Create: `modules/planning/services/PlanningMaterialService.ts`
- Create: `app/api/planning/[id]/peta/material/route.ts`
- Test: `tests/modules/planning/PlanningMaterialService.test.ts`

**Interfaces:**
- Consumes: `hitungKebutuhanMaterialOsp` (Task 3), `PlanningPetaRepository.ambilTitikPerPlanning` / `.ambilJalurPerPlanning` (Task 6), `IPlanningItemRepository`.
- Produces — service:
  ```ts
  planningMaterialService.hitung(planningId: string, tenantId: string): Promise<KebutuhanMaterialOsp>
  planningMaterialService.terbitkan(planningId: string, userId: string, tenantId: string): Promise<PlanningItemDTO[]>
  ```
- Produces — dua metode baru pada `PlanningItemRepository` (dan port `IPlanningItemRepository`):
  ```ts
  upsertBySourceKey(data: {
    planningId: string; tenantId: string; sourceKey: string;
    name: string; unit: string; quantity: number; notes: string;
    isAutoGenerated: true;
  }): Promise<PlanningItemEntity>

  hapusOtomatisYangTidakDipakai(filter: {
    planningId: string; isAutoGenerated: true; sourceKeyDipakai: string[];
  }): Promise<number>
  ```

**Kunci `sourceKey`:** `kabel:<jenisFiber>` dan `splitter:<rasio>`.

**Sebelum menulis tes audit:** buka `modules/planning/services/PlanningAuditService.ts`
dan pakai nama metode yang sebenarnya — contoh tes di bawah menuliskan
`auditService.catat`, sesuaikan bila berbeda.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
it("membuat item kabel dengan jumlah siap pesan dan asal angkanya", async () => {
  await service.terbitkan("plan-1", "user-1", "tenant-1");

  expect(itemRepo.upsertBySourceKey).toHaveBeenCalledWith(
    expect.objectContaining({
      planningId: "plan-1",
      sourceKey: "kabel:feeder",
      name: "Kabel feeder",
      unit: "meter",
      quantity: 220,
      isAutoGenerated: true,
      notes: "terukur 200 m + cadangan 10%",
    }),
  );
});

it("tidak pernah menyentuh item yang diketik manusia", async () => {
  itemRepo.hapusOtomatisYangTidakDipakai.mockResolvedValue(0);

  await service.terbitkan("plan-1", "user-1", "tenant-1");

  const dihapus = itemRepo.hapusOtomatisYangTidakDipakai.mock.calls[0][0];
  expect(dihapus.isAutoGenerated).toBe(true);
});

it("idempoten: menerbitkan dua kali tidak menggandakan item", async () => {
  await service.terbitkan("plan-1", "user-1", "tenant-1");
  await service.terbitkan("plan-1", "user-1", "tenant-1");

  const kunci = itemRepo.upsertBySourceKey.mock.calls.map((c) => c[0].sourceKey);
  expect(new Set(kunci).size).toBe(kunci.length / 2);
});

it("menolak menerbitkan material pada planning yang sudah disetujui", async () => {
  // Material yang berubah setelah APPROVED berarti yang disetujui direksi
  // bukan yang dibeli.
  planningRepo.findById.mockResolvedValue({
    id: "plan-1",
    tenantId: "tenant-1",
    status: "APPROVED",
  });

  await expect(
    service.terbitkan("plan-1", "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningInvalidStateError);
});

it("menulis audit saat material diterbitkan", async () => {
  await service.terbitkan("plan-1", "user-1", "tenant-1");

  expect(auditService.catat).toHaveBeenCalledWith(
    expect.objectContaining({ action: "ITEM_UPDATED" }),
  );
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/modules/planning/PlanningMaterialService.test.ts`

- [ ] **Step 3: Implementasikan**

Service mengambil titik & jalur rencana lewat `PlanningPetaRepository`, memanggil `hitungKebutuhanMaterialOsp` dengan `planning.spareKabelPersen`, lalu memetakan rekap menjadi item:

| Rekap | `name` | `unit` | `quantity` | `sourceKey` |
|---|---|---|---|---|
| kabel | `Kabel <jenisFiber>` | `meter` | `meterDipesan` | `kabel:<jenisFiber>` |
| splitter | `Splitter <rasio>` | `unit` | `jumlah` | `splitter:<rasio>` |

`notes` item kabel: `terukur <meterTerukur> m + cadangan <persen>%`. Bila cadangan 0, tulis `terukur <meterTerukur> m` saja.

Seluruh penulisan dalam satu transaksi lewat `PrismaPlanningUnitOfWork`. Setelah upsert, hapus item `isAutoGenerated: true` yang `sourceKey`-nya tidak lagi muncul.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

- [ ] **Step 5: Buat route**

`POST /api/planning/[id]/peta/material` dengan `permissions: ["planning:update"]`; `GET` untuk pratinjau dengan `["planning:read"]` yang memanggil `.hitung()` tanpa menulis.

- [ ] **Step 6: Uji mutasi**

Hapus penjaga status `APPROVED`, jalankan tes, pastikan **merah**, kembalikan.

- [ ] **Step 7: Changelog & commit**

```bash
git commit -m "feat(planning): terbitkan kebutuhan kabel dan splitter menjadi item material

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Tab Peta pada halaman detail planning

**Files:**
- Create: `app/admin/planning/[id]/peta/PlanningPetaTab.tsx`
- Create: `app/admin/planning/[id]/peta/FormTitikRencana.tsx`
- Create: `app/admin/planning/[id]/peta/PanelRingkasanMaterial.tsx`
- Modify: `app/admin/planning/[id]/PlanningDetailClient.tsx`
- Test: `tests/app/admin/planning-peta-tab.test.tsx`

**Interfaces:**
- Consumes: route dari Task 5, 6, 8.
- Produces: tab "Peta" pada detail planning.

- [ ] **Step 1: Baca komponen peta yang akan dipakai ulang**

Baca `components/map/NetworkMapInteractive.tsx`, `components/map/useMapData.ts`, dan `components/map/map-api-client.ts`. Catat bagaimana `tileUrl`, penggambaran jalur, dan `calculateMapDistance` dipakai — komponen ini **dipakai ulang**, bukan ditulis ulang.

- [ ] **Step 2: Tulis tes komponen yang gagal**

Buat `tests/app/admin/planning-peta-tab.test.tsx` mengikuti pola `tests/app/admin/announcement-status-kolom.test.tsx` (jsdom, mock komponen berat, periksa perilaku). Kasus:

```ts
it("menampilkan latitude dan longitude dari tautan yang ditempel", async () => { /* ... */ });
it("menampilkan pesan dan tidak mengisi koordinat saat tautan gagal diurai", async () => { /* ... */ });
it("mewajibkan rasio splitter dipilih sebelum titik bisa disimpan", async () => { /* ... */ });
it("memperbarui angka pesanan saat persentase cadangan diubah", async () => { /* ... */ });
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

- [ ] **Step 4: Implementasikan `FormTitikRencana`**

Tiga cara input dalam satu form: klik peta (mengisi field), ketik lat/long (marker ikut berpindah), tempel tautan (memanggil `POST /api/planning/tautan-peta/uraikan`). Dropdown splitter **tanpa nilai terpilih** dan bertanda wajib. Saat tautan gagal, tampilkan pesan dari respons dan biarkan field koordinat kosong.

- [ ] **Step 5: Implementasikan `PanelRingkasanMaterial`**

Tabel kabel per jenis dengan kolom terukur dan dipesan, tabel splitter per rasio, jumlah titik, field persentase cadangan (0–100) yang memanggil pratinjau `GET .../peta/material` saat diubah, dan tombol "Perbarui kebutuhan material" yang memanggil `POST`.

- [ ] **Step 6: Implementasikan `PlanningPetaTab`**

Peta dengan node nyata sebagai latar redup (`lingkup: "semua"` lewat endpoint peta planning) dan node rencana menonjol. Gunakan `components/map` yang ada untuk penggambaran jalur.

- [ ] **Step 7: Pasang tab di `PlanningDetailClient.tsx`**

- [ ] **Step 8: Jalankan tes, pastikan lulus**

- [ ] **Step 9: Verifikasi di aplikasi**

Jalankan dev server, buat satu planning uji, tambahkan dua titik dan satu jalur, periksa angka kabel dan splitter, lalu terbitkan material dan pastikan muncul di tab Item. Hapus data uji setelah selesai.

```bash
rm -rf .next && nohup npm run dev > /tmp/devserver.log 2>&1 &
```

- [ ] **Step 10: Changelog & commit**

```bash
git commit -m "feat(planning): tab peta perencanaan dengan titik, jalur, dan ringkasan material

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Terbitkan titik rencana menjadi node nyata

**Files:**
- Modify: `modules/planning/services/PlanningPetaService.ts`
- Create: `app/api/planning/[id]/peta/terbitkan/route.ts`
- Test: `tests/modules/planning/terbitkan-titik-rencana.test.ts`
- Test: `tests/api/planning-terbitkan-izin.test.ts`

**Interfaces:**
- Consumes: Task 1 & 6 (`PlanningPetaRepository`, `planningPetaService`).
- Produces:
  ```ts
  // service
  planningPetaService.terbitkan(planningId: string, userId: string, tenantId: string): Promise<{ titikTerbit: number; jalurTerbit: number }>

  // metode BARU pada PlanningPetaRepository dari Task 6
  tandaiTerbit(planningId: string, tenantId: string): Promise<{ titikTerbit: number; jalurTerbit: number }>
  ```

- [ ] **Step 1: Tulis tes yang gagal**

```ts
it("melepas penanda rencana tanpa menyalin data", async () => {
  await service.terbitkan("plan-1", "user-1", "tenant-1");

  expect(repo.tandaiTerbit).toHaveBeenCalledWith("plan-1", "tenant-1");
  expect(repo.buatTitik).not.toHaveBeenCalled();
});

it("mempertahankan planningId sebagai jejak asal-usul", async () => {
  await service.terbitkan("plan-1", "user-1", "tenant-1");

  const data = repo.tandaiTerbit.mock.calls[0];
  expect(data).not.toContain("planningId: null");
});

it("menolak menerbitkan planning yang belum disetujui", async () => {
  planningRepo.findById.mockResolvedValue({
    id: "plan-1",
    tenantId: "tenant-1",
    status: "BACKLOG",
  });

  await expect(
    service.terbitkan("plan-1", "user-1", "tenant-1"),
  ).rejects.toBeInstanceOf(PlanningInvalidStateError);
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

- [ ] **Step 3: Implementasikan**

`tandaiTerbit` menjalankan satu `updateMany` yang menyetel `isPlanned: false` untuk seluruh node **dan** edge milik planning itu, dalam satu transaksi. `planningId` **tidak** dikosongkan.

Syarat status: hanya planning ber-status `APPROVED`, `IN_PROGRESS`, atau `COMPLETED` yang boleh diterbitkan.

- [ ] **Step 4: Buat route dengan izin ganda**

```ts
export const POST = createHandler(
  {
    auth: true,
    // Merencanakan bebas; memasukkan node ke topologi operasional menuntut
    // hak atas peta.
    permissions: ["planning:update", "map:create"],
  },
  async (_req, ctx) => { /* panggil service */ },
);
```

Periksa dulu di `lib/api` apakah `permissions` berarti "semua harus dimiliki" atau "salah satu cukup". Bila "salah satu", tambahkan pemeriksaan kedua secara eksplisit di route dan uji.

- [ ] **Step 5: Tulis tes izin**

`tests/api/planning-terbitkan-izin.test.ts`: pengguna dengan `planning:update` tetapi tanpa `map:create` mendapat 403, dan service tidak pernah dipanggil.

- [ ] **Step 6: Jalankan tes, pastikan lulus**

- [ ] **Step 7: Uji mutasi**

Hapus `map:create` dari daftar izin, jalankan tes izin, pastikan **merah**, kembalikan.

- [ ] **Step 8: Verifikasi penuh**

```bash
npx vitest run tests/modules/planning tests/modules/map tests/api/planning-terbitkan-izin.test.ts tests/lib/geo
npx tsc --noEmit -p tsconfig.json
npx eslint modules/planning app/api/planning app/admin/planning lib/geo
```

- [ ] **Step 9: Changelog & commit**

```bash
git commit -m "feat(planning): terbitkan titik rencana menjadi node topologi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Catatan penutup

Dua pertanyaan terbuka dari §12 spesifikasi diputuskan di rencana ini:

1. **Penerbitan dilakukan sekaligus satu planning**, bukan per titik (Task 10), karena persetujuan juga berlaku untuk seluruh planning — menerbitkan sebagian berarti sebagian jaringan nyata berasal dari rencana yang belum tuntas disetujui.
2. **Titik dari planning yang ditolak atau dibatalkan dibiarkan sebagai arsip** dengan `isPlanned: true`, sehingga tidak terlihat di topologi operasional tetapi tetap bisa ditinjau. Task 6 menambahkan jalur untuk merapikan titik yatim bila planning induknya dihapus.

Bila salah satu keputusan ini tidak sesuai, ubah sebelum Task 6 dimulai — keduanya memengaruhi bentuk service.
