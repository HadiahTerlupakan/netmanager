import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ isSuperAdmin: () => false }));
vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi
    .fn()
    .mockResolvedValue({ tenantId: "tenant-1", isSuperAdmin: false }),
}));

import { InventoryOpnameService } from "@/modules/inventory/services/InventoryOpnameService";

const USER = { id: "user-1", name: "Admin Gudang", tenantId: "tenant-1" };
const OPNAME_RECORD = {
  id: "so-1",
  gudang: {
    id: "g-1",
    kode: "GDG",
    nama: "Gudang Utama",
    lokasi: null as string | null,
  },
  barang: { id: "b-1", kode: "KBL", nama: "Kabel 1 core", satuan: "m" },
};

function createService() {
  const repository = {
    getOpnameRecord: vi.fn().mockResolvedValue(OPNAME_RECORD),
    updateOpname: vi
      .fn()
      .mockResolvedValue({ record: {}, stokSistem: 100, selisih: -4 }),
    deleteOpname: vi.fn(),
  };
  return new InventoryOpnameService(repository as never);
}

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas ubah & hapus stock opname", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat perubahan stok fisik beserta selisihnya", async () => {
    await createService().updateOpname({
      id: "so-1",
      stokFisik: 96,
      keterangan: "hitung ulang",
      user: USER,
    });

    expect(lastActivity()).toEqual({
      action: "UPDATE",
      subject: "Stock Opname Kabel 1 core",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        opnameId: "so-1",
        barang: "Kabel 1 core",
        gudang: "Gudang Utama",
        stokFisik: 96,
        stokSistem: 100,
        selisih: -4,
        keterangan: "hitung ulang",
      },
    });
  });

  it("mencatat penghapusan stock opname", async () => {
    await createService().deleteOpname({ id: "so-1", user: USER });

    expect(lastActivity()).toMatchObject({
      action: "DELETE",
      subject: "Stock Opname Kabel 1 core",
      tenantId: "tenant-1",
      details: {
        opnameId: "so-1",
        barang: "Kabel 1 core",
        gudang: "Gudang Utama",
      },
    });
  });
});
