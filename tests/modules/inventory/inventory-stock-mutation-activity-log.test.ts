import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { InventoryKeluarRouteService } from "@/modules/inventory/services/InventoryKeluarRouteService";
import { InventoryMasukRouteService } from "@/modules/inventory/services/InventoryMasukRouteService";
import { InventoryTransferRouteService } from "@/modules/inventory/services/InventoryTransferRouteService";

const ACTOR = {
  userId: "user-1",
  permissions: [] as string[],
  isSuperAdmin: true,
};

const GUDANG = {
  id: "g-1",
  kode: "GDG",
  nama: "Gudang Utama",
  sites: [] as Array<{ id: string }>,
};
const BARANG = { id: "b-1", kode: "KBL", nama: "Kabel 1 core", satuan: "m" };

function siteResolver() {
  return { resolveRestrictedSiteId: vi.fn().mockResolvedValue(undefined) };
}

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas ubah & hapus transaksi stok", () => {
  beforeEach(() => logActivitySafe.mockReset());

  describe("barang masuk", () => {
    function createMasukService() {
      const stockMovement = {
        getMasukRecord: vi.fn().mockResolvedValue({
          id: "bm-1",
          jumlah: 100,
          gudang: GUDANG,
          barang: BARANG,
        }),
        updateMasuk: vi.fn(),
        deleteMasuk: vi.fn(),
      };
      const service = new InventoryMasukRouteService(
        {} as never,
        siteResolver() as never,
        stockMovement as never,
      );
      return service;
    }

    it("mencatat perubahan jumlah barang masuk", async () => {
      const result = await createMasukService().updateMasuk({
        id: "bm-1",
        ...ACTOR,
        body: { jumlah: 80, keterangan: "salah input" },
      });

      expect(result.success).toBe(true);
      expect(lastActivity()).toEqual({
        action: "UPDATE",
        subject: "Barang Masuk Kabel 1 core",
        userId: "user-1",
        tenantId: undefined,
        details: {
          barangMasukId: "bm-1",
          barang: "Kabel 1 core",
          gudang: "Gudang Utama",
          jumlahLama: 100,
          jumlahBaru: 80,
          kondisi: undefined,
          keterangan: "salah input",
        },
      });
    });

    it("mencatat penghapusan barang masuk", async () => {
      await createMasukService().deleteMasuk({ id: "bm-1", ...ACTOR });

      expect(lastActivity()).toMatchObject({
        action: "DELETE",
        subject: "Barang Masuk Kabel 1 core",
        details: { barangMasukId: "bm-1", jumlah: 100, gudang: "Gudang Utama" },
      });
    });
  });

  describe("barang keluar", () => {
    function createKeluarService() {
      const routeService = {
        ...siteResolver(),
        getKeluarRecordWithSite: vi.fn().mockResolvedValue({
          id: "bk-1",
          gudang: { sites: [] },
        }),
        updateKeluarRecord: vi.fn().mockResolvedValue({
          barangNama: "Kabel 1 core",
          jumlahLama: 50,
          jumlah: 40,
        }),
        deleteKeluarRecord: vi
          .fn()
          .mockResolvedValue({ barangNama: "Kabel 1 core", jumlah: 50 }),
      };
      return new InventoryKeluarRouteService(
        {} as never,
        routeService as never,
      );
    }

    it("mencatat perubahan jumlah barang keluar", async () => {
      await createKeluarService().updateKeluar({
        id: "bk-1",
        ...ACTOR,
        body: { jumlah: 40 },
      });

      expect(lastActivity()).toMatchObject({
        action: "UPDATE",
        subject: "Barang Keluar Kabel 1 core",
        userId: "user-1",
        details: { barangKeluarId: "bk-1", jumlahLama: 50, jumlahBaru: 40 },
      });
    });

    it("mencatat penghapusan barang keluar", async () => {
      await createKeluarService().deleteKeluar({ id: "bk-1", ...ACTOR });

      expect(lastActivity()).toMatchObject({
        action: "DELETE",
        subject: "Barang Keluar Kabel 1 core",
        details: { barangKeluarId: "bk-1", jumlah: 50 },
      });
    });
  });

  describe("transfer", () => {
    const TRANSFER = {
      id: "trf-1",
      kodeTransfer: "TRF-20261017-0001",
      barangId: "b-1",
      dariGudangId: "g-1",
      keGudangId: "g-2",
      jumlah: 5,
      kondisi: "BARU",
      keterangan: null as string | null,
      tenantId: "tenant-1",
    };

    function createTransferService() {
      const repository = {
        findTransferById: vi.fn().mockResolvedValue(TRANSFER),
        updateTransfer: vi
          .fn()
          .mockResolvedValue({ ...TRANSFER, keterangan: "koreksi" }),
        deleteTransfer: vi.fn(),
      };
      return new InventoryTransferRouteService(
        repository as never,
        siteResolver() as never,
      );
    }

    it("mencatat perubahan keterangan transfer", async () => {
      await createTransferService().updateTransfer({
        id: "trf-1",
        ...ACTOR,
        body: { keterangan: "koreksi" },
      });

      expect(lastActivity()).toEqual({
        action: "UPDATE",
        subject: "Transfer Barang TRF-20261017-0001",
        userId: "user-1",
        tenantId: "tenant-1",
        details: {
          transferId: "trf-1",
          keteranganLama: null,
          keteranganBaru: "koreksi",
        },
      });
    });

    it("mencatat penghapusan transfer", async () => {
      await createTransferService().deleteTransfer({ id: "trf-1", ...ACTOR });

      expect(lastActivity()).toMatchObject({
        action: "DELETE",
        subject: "Transfer Barang TRF-20261017-0001",
        tenantId: "tenant-1",
        details: {
          transferId: "trf-1",
          barangId: "b-1",
          dariGudangId: "g-1",
          keGudangId: "g-2",
          jumlah: 5,
          kondisi: "BARU",
        },
      });
    });
  });
});
