import { describe, expect, it, vi } from "vitest";

import { findInventoryBarangDetail } from "@/modules/inventory/repositories/inventory-repository-core-helpers";

/** Prisma palsu yang merekam argumen `barang.findUnique`. */
function dbPalsu() {
  const findUnique = vi.fn().mockResolvedValue({
    id: "barang-1",
    barangGudang: [],
    barang_masuk: [],
    barang_keluar: [],
    stockOpname: [],
  });
  return { db: { barang: { findUnique } } as never, findUnique };
}

describe("findInventoryBarangDetail", () => {
  it("menyaring mutasi terbaru ke gudang di site yang diminta di level query", async () => {
    const { db, findUnique } = dbPalsu();

    await findInventoryBarangDetail(db, "barang-1", {
      masuk: ["site-1"],
      keluar: [],
      opname: undefined,
    });

    const { include } = findUnique.mock.calls[0][0];
    expect(include.barang_masuk.where).toEqual({
      gudang: { sites: { some: { id: { in: ["site-1"] } } } },
    });
    // `[]` = dibatasi tanpa site: klausa `in: []` tidak cocok baris mana pun.
    expect(include.barang_keluar.where).toEqual({
      gudang: { sites: { some: { id: { in: [] } } } },
    });
    expect(include.stockOpname.where).toBeUndefined();
    expect(include.barang_masuk.take).toBe(10);
  });

  it("tanpa saringan tidak membatasi mutasi", async () => {
    const { db, findUnique } = dbPalsu();

    await findInventoryBarangDetail(db, "barang-1");

    const { include } = findUnique.mock.calls[0][0];
    expect(include.barang_masuk.where).toBeUndefined();
    expect(include.barang_keluar.where).toBeUndefined();
    expect(include.stockOpname.where).toBeUndefined();
  });
});
