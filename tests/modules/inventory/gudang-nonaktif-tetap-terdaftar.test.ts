import { describe, expect, it, vi } from "vitest";

import { InventoryStockQueryRepository } from "@/modules/inventory/repositories/InventoryStockQueryRepository";

/**
 * Siapa yang boleh melihat gudang nonaktif.
 *
 * Filter `isActive: true` dulu dikunci di dalam query ini, jadi layar
 * manajemen gudang pun tidak bisa menampilkannya: begitu sebuah gudang
 * dinonaktifkan, barisnya lenyap dari daftar — bukan berubah status —
 * dan tidak ada jalan di antarmuka untuk mengaktifkannya kembali.
 *
 * Default-nya tetap hanya gudang aktif: puluhan pemilih gudang (opname,
 * restock, penerimaan barang) bergantung padanya dan tidak boleh menawarkan
 * gudang yang sudah ditutup.
 */
describe("getAllGudang dan gudang nonaktif", () => {
  function pasangRepositori() {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { gudang: { findMany } };
    return {
      findMany,
      repository: new InventoryStockQueryRepository(db as never),
    };
  }

  it("hanya mengambil gudang aktif secara default", async () => {
    const { findMany, repository } = pasangRepositori();

    await repository.getAllGudang();

    expect(findMany.mock.calls[0][0].where).toMatchObject({ isActive: true });
  });

  it("tetap menyaring gudang aktif saat dibatasi per site", async () => {
    const { findMany, repository } = pasangRepositori();

    await repository.getAllGudang({ siteId: "site-1" });

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      isActive: true,
      sites: { some: { id: "site-1" } },
    });
  });

  it("tidak menyaring status saat includeInactive diminta", async () => {
    const { findMany, repository } = pasangRepositori();

    await repository.getAllGudang({ includeInactive: true });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("isActive");
  });

  it("menggabungkan includeInactive dengan pembatasan site", async () => {
    const { findMany, repository } = pasangRepositori();

    await repository.getAllGudang({ siteId: "site-1", includeInactive: true });

    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("isActive");
    expect(where).toMatchObject({ sites: { some: { id: "site-1" } } });
  });
});
