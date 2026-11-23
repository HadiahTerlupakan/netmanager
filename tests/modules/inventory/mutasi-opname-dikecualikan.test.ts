import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mutasi hasil stock opname (`opnameId` terisi) adalah koreksi selisih, bukan
 * pemakaian atau restock. Prediksi restock, rata-rata pemakaian setting
 * restock, dan dashboard inventory harus menyaringnya keluar.
 */

const prismaMock = vi.hoisted(() => {
  const model = () => ({
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _sum: { stok: 0 } }),
  });
  return {
    barang: model(),
    gudang: model(),
    asset: model(),
    barangMasuk: model(),
    barangKeluar: model(),
    barangGudang: model(),
    transferAntarGudang: model(),
  };
});

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));
vi.mock(
  "@/modules/inventory/repositories/inventory-api-repository-helpers",
  async (asli) => ({
    ...(await asli<object>()),
    findMonthlyUsageNumbers: vi.fn().mockResolvedValue([0, 0, 0, 0, 0, 0]),
  }),
);

import { buildRestockPrediction } from "@/modules/inventory/repositories/inventory-restock-repository.predictions";
import { getRestockSettingContext } from "@/modules/inventory/repositories/inventory-restock-repository.settings";
import { InventoryRestockRepository } from "@/modules/inventory/repositories/InventoryRestockRepository";
import { fetchInventoryDashboardQueries } from "@/modules/inventory/services/inventory-dashboard.queries";

const TANPA_OPNAME = { opnameId: null as string | null };

function whereOf(mockFn: { mock: { calls: unknown[][] } }, callIndex = 0) {
  return (mockFn.mock.calls[callIndex][0] as { where: unknown }).where;
}

describe("prediksi restock", () => {
  it("restock terakhir dan pemakaian terbaru mengabaikan mutasi opname", async () => {
    const db = {
      barangGudang: { findUnique: vi.fn().mockResolvedValue({ stok: 5 }) },
      barangMasuk: { findFirst: vi.fn().mockResolvedValue(null) },
      barangKeluar: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { jumlah: 0 } }),
      },
      restockSettings: { update: vi.fn() },
    };

    await buildRestockPrediction(
      db as never,
      {
        id: "setting-1",
        barangId: "barang-1",
        gudangId: "gudang-1",
        minStok: 1,
        maxStok: 10,
        avgDailyUsage: 0,
        leadTimeDays: 7,
        safetyStok: 0,
        barang: { kode: "B1", nama: "Kabel", satuan: "roll" },
        gudang: { kode: "G1", nama: "Gudang" },
      },
      30,
    );

    expect(whereOf(db.barangMasuk.findFirst)).toMatchObject(TANPA_OPNAME);
    expect(whereOf(db.barangKeluar.aggregate)).toMatchObject(TANPA_OPNAME);
  });
});

describe("setting restock", () => {
  it("rata-rata pemakaian 30 hari mengabaikan mutasi opname", async () => {
    const tx = {
      barang: { findUnique: vi.fn().mockResolvedValue({ id: "barang-1" }) },
      gudang: { findUnique: vi.fn().mockResolvedValue({ id: "gudang-1" }) },
      barangKeluar: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { jumlah: 30 } }),
      },
    };

    await getRestockSettingContext(tx as never, {
      barangId: "barang-1",
      gudangId: "gudang-1",
    });

    expect(whereOf(tx.barangKeluar.aggregate)).toMatchObject(TANPA_OPNAME);
  });
});

describe("dashboard inventory", () => {
  beforeEach(() => vi.clearAllMocks());

  async function runDashboard() {
    await fetchInventoryDashboardQueries(
      { gudangFilter: {}, transactionFilter: {} },
      {
        start: new Date("2026-06-01"),
        end: new Date("2026-11-23"),
        monthStart: new Date("2026-11-01"),
      },
    );
  }

  it("transaksi bulan ini tidak menghitung mutasi opname", async () => {
    await runDashboard();

    expect(whereOf(prismaMock.barangMasuk.count)).toMatchObject(TANPA_OPNAME);
    expect(whereOf(prismaMock.barangKeluar.count)).toMatchObject(TANPA_OPNAME);
  });

  it("tren bulanan dan fast-moving tidak menghitung mutasi opname", async () => {
    await runDashboard();

    expect(whereOf(prismaMock.barangMasuk.groupBy)).toMatchObject(TANPA_OPNAME);
    for (const call of prismaMock.barangKeluar.groupBy.mock.calls) {
      expect((call[0] as { where: unknown }).where).toMatchObject(TANPA_OPNAME);
    }
    expect(prismaMock.barangKeluar.groupBy).toHaveBeenCalledTimes(2);
  });

  it("slow-moving menilai pergerakan dari barang keluar non-opname", async () => {
    await runDashboard();

    const slowMovingArgs = prismaMock.barang.findMany.mock.calls[0][0] as {
      where: { barang_keluar: { none: unknown } };
      select: { barang_keluar: { where: unknown } };
    };
    expect(slowMovingArgs.where.barang_keluar.none).toMatchObject(TANPA_OPNAME);
    expect(slowMovingArgs.select.barang_keluar.where).toEqual(TANPA_OPNAME);
  });
});

describe("analitik pemakaian restock", () => {
  beforeEach(() => vi.clearAllMocks());

  // Regresi: total pemakaian dan grafik pemakaian bulanan masih menghitung
  // selisih opname, berbeda dengan rata-rata harian di layar yang sama.
  it("total pemakaian dan pemakaian bulanan mengabaikan mutasi opname", async () => {
    const db = {
      barangKeluar: {
        aggregate: vi
          .fn()
          .mockResolvedValue({ _sum: { jumlah: 0 }, _count: { id: 0 } }),
      },
      barangGudang: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    prismaMock.barangKeluar.aggregate.mockResolvedValue({
      _sum: { jumlah: 0 },
    });

    await new InventoryRestockRepository(db as never).findUsageAnalytics({
      barangId: "barang-1",
      gudangId: "gudang-1",
      days: 30,
    });

    expect(whereOf(db.barangKeluar.aggregate)).toMatchObject(TANPA_OPNAME);
    expect(prismaMock.barangKeluar.aggregate).toHaveBeenCalled();
    for (const call of prismaMock.barangKeluar.aggregate.mock.calls) {
      expect((call[0] as { where: unknown }).where).toMatchObject(TANPA_OPNAME);
    }
  });
});
