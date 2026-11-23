import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock(
  "@/modules/inventory/services/inventory-activity-log",
  async (asli) => ({
    ...(await asli<object>()),
    recordInventoryActivity: vi.fn(),
  }),
);

import { InventoryUserError } from "@/modules/inventory/domain/inventory-user-error";
import {
  MUTASI_OPNAME_TERKUNCI_PESAN,
  isMutasiOpname,
} from "@/modules/inventory/domain/mutasi-opname-terkunci";
import {
  deleteMasuk,
  updateMasuk,
} from "@/modules/inventory/repositories/inventory-repository-masuk-helpers";
import { InventoryOpnameApiRepository } from "@/modules/inventory/repositories/InventoryOpnameApiRepository";
import { InventoryKeluarRouteService } from "@/modules/inventory/services/InventoryKeluarRouteService";

/**
 * Barang keluar hasil stock opname milik opname-nya. Mengubah atau menghapusnya
 * dari daftar Barang Keluar menggeser stok tanpa mengubah opname, lalu stok
 * terbalik dua kali saat opname dihapus — jadi harus ditolak.
 */

const CONFLICT_STATUS = 409;

const KELUAR_OPNAME = {
  id: "keluar-1",
  barangId: "barang-1",
  gudangId: "gudang-1",
  jumlah: 2,
  kondisi: "BARU",
  opnameId: "opname-1",
  barang: { nama: "Kabel Drop", satuan: "roll" },
  gudang: { nama: "Gudang Utama" },
};

function buildRepository(record: Record<string, unknown>) {
  const tx = {
    barangKeluar: {
      findUnique: vi.fn().mockResolvedValue(record),
      update: vi.fn(),
      delete: vi.fn(),
    },
    barangGudang: {
      findUnique: vi.fn().mockResolvedValue({ stok: 10, stokBaru: 10 }),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  const db = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { tx, repository: new InventoryOpnameApiRepository(db as never) };
}

async function captureError(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(InventoryUserError);
  return error as InventoryUserError;
}

describe("isMutasiOpname", () => {
  it("hanya baris ber-opnameId yang dianggap hasil opname", () => {
    expect(isMutasiOpname({ opnameId: "opname-1" })).toBe(true);
    expect(isMutasiOpname({ opnameId: null })).toBe(false);
    expect(isMutasiOpname({})).toBe(false);
  });
});

describe("InventoryOpnameApiRepository menolak mutasi hasil opname", () => {
  it("ubah barang keluar hasil opname: 409, stok dan catatan tidak disentuh", async () => {
    const { tx, repository } = buildRepository(KELUAR_OPNAME);

    const error = await captureError(
      repository.updateKeluarRecord({ id: "keluar-1", jumlah: 5 }),
    );

    expect(error.status).toBe(CONFLICT_STATUS);
    expect(error.message).toBe(MUTASI_OPNAME_TERKUNCI_PESAN);
    expect(tx.barangKeluar.update).not.toHaveBeenCalled();
    expect(tx.barangGudang.update).not.toHaveBeenCalled();
  });

  it("hapus barang keluar hasil opname: 409, stok tidak dikembalikan", async () => {
    const { tx, repository } = buildRepository(KELUAR_OPNAME);

    const error = await captureError(repository.deleteKeluarRecord("keluar-1"));

    expect(error.status).toBe(CONFLICT_STATUS);
    expect(tx.barangKeluar.delete).not.toHaveBeenCalled();
    expect(tx.barangGudang.update).not.toHaveBeenCalled();
    expect(tx.barangGudang.create).not.toHaveBeenCalled();
  });

  it("barang keluar biasa tetap bisa dihapus", async () => {
    const { tx, repository } = buildRepository({
      ...KELUAR_OPNAME,
      opnameId: null,
    });

    await repository.deleteKeluarRecord("keluar-1");

    expect(tx.barangKeluar.delete).toHaveBeenCalledWith({
      where: { id: "keluar-1" },
    });
  });
});

describe("InventoryKeluarRouteService meneruskan penolakan sebagai 409", () => {
  function buildService() {
    const { repository } = buildRepository(KELUAR_OPNAME);
    const inventoryRouteService = {
      resolveLingkupSite: vi.fn().mockResolvedValue({ dibatasi: false }),
      canAccessGudang: vi.fn().mockResolvedValue(true),
      getKeluarRecordWithSite: vi
        .fn()
        .mockResolvedValue({ ...KELUAR_OPNAME, gudang: { sites: [] } }),
      updateKeluarRecord: (input: { id: string; jumlah: number }) =>
        repository.updateKeluarRecord(input),
      deleteKeluarRecord: (id: string) => repository.deleteKeluarRecord(id),
    };
    return new InventoryKeluarRouteService(
      {} as never,
      inventoryRouteService as never,
    );
  }

  const AKSES = {
    id: "keluar-1",
    userId: "user-1",
    permissions: [] as string[],
    isSuperAdmin: true,
  };

  it("PUT barang keluar hasil opname", async () => {
    const result = await buildService().updateKeluar({
      ...AKSES,
      body: { jumlah: 5 },
    });

    expect(result).toEqual({
      success: false,
      status: CONFLICT_STATUS,
      error: MUTASI_OPNAME_TERKUNCI_PESAN,
    });
  });

  it("DELETE barang keluar hasil opname", async () => {
    const result = await buildService().deleteKeluar(AKSES);

    expect(result).toEqual({
      success: false,
      status: CONFLICT_STATUS,
      error: MUTASI_OPNAME_TERKUNCI_PESAN,
    });
  });
});

describe("barang masuk hasil opname juga terkunci", () => {
  const MASUK_OPNAME = {
    id: "masuk-1",
    barangId: "barang-1",
    gudangId: "gudang-1",
    jumlah: 4,
    kondisi: "BARU",
    opnameId: "opname-1",
    barang: { nama: "Kabel Drop" },
    gudang: { nama: "Gudang Utama" },
  };

  function buildMasukDb(record: Record<string, unknown>) {
    const tx = {
      barangMasuk: {
        findUnique: vi.fn().mockResolvedValue(record),
        update: vi.fn(),
        delete: vi.fn(),
      },
      barangGudang: {
        findUnique: vi.fn().mockResolvedValue({ stok: 10, stokBaru: 10 }),
        update: vi.fn(),
      },
    };
    const db = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    return { tx, db };
  }

  // Regresi: hanya tombolnya yang disembunyikan; DELETE langsung ke API
  // mengurangi stok, lalu hapus opname mengurangi lagi.
  it("hapus barang masuk hasil opname: 409, stok tidak dikurangi", async () => {
    const { tx, db } = buildMasukDb(MASUK_OPNAME);

    const error = await deleteMasuk(db as never, "masuk-1").catch((e) => e);

    expect(error).toBeInstanceOf(InventoryUserError);
    expect(error.status).toBe(CONFLICT_STATUS);
    expect(error.message).toBe(MUTASI_OPNAME_TERKUNCI_PESAN);
    expect(tx.barangGudang.update).not.toHaveBeenCalled();
    expect(tx.barangMasuk.delete).not.toHaveBeenCalled();
  });

  it("ubah barang masuk hasil opname: 409, catatan tidak disentuh", async () => {
    const { tx, db } = buildMasukDb(MASUK_OPNAME);

    const error = await updateMasuk(
      db as never,
      {
        id: "masuk-1",
        jumlah: 9,
      } as never,
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InventoryUserError);
    expect(error.status).toBe(CONFLICT_STATUS);
    expect(tx.barangMasuk.update).not.toHaveBeenCalled();
    expect(tx.barangGudang.update).not.toHaveBeenCalled();
  });
});
