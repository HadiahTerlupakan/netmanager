import { describe, expect, it, vi } from "vitest";

import { calculateInitialOpnameItems } from "@/modules/inventory/repositories/inventory-opname-api-calculation.helpers";

const SEKARANG = new Date("2026-10-15T03:00:00.000Z");

function buatDb(soRows: { barangId: string; tanggal: Date; pic: string | null }[]) {
  return {
    barangGudang: {
      findMany: vi.fn().mockResolvedValue([
        {
          stok: 5,
          barang: { id: "b1", kode: "B-01", nama: "Kabel", satuan: "m" },
          gudang: { id: "g1", nama: "Gudang Utama" },
        },
        {
          stok: 2,
          barang: { id: "b2", kode: "B-02", nama: "ONT", satuan: "unit" },
          gudang: { id: "g1", nama: "Gudang Utama" },
        },
      ]),
    },
    barangMasuk: { findMany: vi.fn().mockResolvedValue([]) },
    barangKeluar: { findMany: vi.fn().mockResolvedValue([]) },
    stockOpname: { findMany: vi.fn().mockResolvedValue(soRows) },
  };
}

describe("calculateInitialOpnameItems — SO bulan ini", () => {
  it("menandai SO terbaru per barang di bulan berjalan dan null bila belum di-SO", async () => {
    const db = buatDb([
      { barangId: "b1", tanggal: new Date("2026-10-10T02:00:00.000Z"), pic: "Budi" },
      { barangId: "b1", tanggal: new Date("2026-10-02T02:00:00.000Z"), pic: "Ani" },
    ]);

    const items = await calculateInitialOpnameItems({
      db: db as never,
      gudangId: "g1",
      tenantFilter: { tenantId: "t-1" },
      sekarang: SEKARANG,
    });

    expect(items.map((item) => [item.barangId, item.soBulanIni])).toEqual([
      ["b1", { tanggal: new Date("2026-10-10T02:00:00.000Z"), pic: "Budi" }],
      ["b2", null],
    ]);
  });

  it("menyaring tenant dan rentang bulan WIB saat mencari SO bulan ini", async () => {
    const db = buatDb([]);

    await calculateInitialOpnameItems({
      db: db as never,
      gudangId: "g1",
      tenantFilter: { tenantId: "t-1" },
      sekarang: SEKARANG,
    });

    expect(db.stockOpname.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t-1",
          gudangId: "g1",
          barangId: { in: ["b1", "b2"] },
          tanggal: {
            gte: new Date("2026-09-30T17:00:00.000Z"),
            lte: new Date("2026-10-31T16:59:59.999Z"),
          },
        },
      }),
    );
  });
});
