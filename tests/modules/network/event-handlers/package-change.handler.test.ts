import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

// --- Mocks ---

const mockSyncSingleCustomer = vi.fn();
const mockHandleStatusChange = vi.fn();
const mockUpdateSyncStatus = vi.fn();
const mockGetPelanggan = vi.fn();

vi.mock("@/modules/network/services/radius-sync-service", () => {
  const MockRadiusSyncService = vi.fn(function (this: unknown) {
    (this as Record<string, unknown>).syncSingleCustomer =
      mockSyncSingleCustomer;
    (this as Record<string, unknown>).handleStatusChange =
      mockHandleStatusChange;
  });
  return { RadiusSyncService: MockRadiusSyncService };
});

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => ({
    updateSyncStatus: mockUpdateSyncStatus,
    getPelanggan: mockGetPelanggan,
  }),
}));

import { handlePackageChange } from "@/modules/network/services/event-handlers/package-change.handler";

// --- Helpers ---

function buildJob(payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName: EVENT_NAMES.PACKAGE_CHANGED,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

const BASE_PAYLOAD = {
  customerId: "cust-1",
  customerName: "Budi",
  oldPackageId: "pkg-old",
  newPackageId: "pkg-new",
  oldProfileName: "Profile-10Mbps",
  newProfileName: "Profile-100Mbps",
  oldPackagePrice: 100000,
  newPackagePrice: 200000,
};

// --- Tests ---

describe("PackageChangeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncSingleCustomer.mockResolvedValue(undefined);
    mockHandleStatusChange.mockResolvedValue(undefined);
    mockUpdateSyncStatus.mockResolvedValue(undefined);
    mockGetPelanggan.mockResolvedValue({ id: "cust-1", status: "AKTIF" });
  });

  it("IMMEDIATE → syncSingleCustomer + handleStatusChange + mark SYNCED", async () => {
    await handlePackageChange(
      buildJob({ ...BASE_PAYLOAD, applyTime: "IMMEDIATE" }),
    );

    expect(mockSyncSingleCustomer).toHaveBeenCalledWith("cust-1");
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "AKTIF");
    expect(mockUpdateSyncStatus).toHaveBeenCalledWith("cust-1", "SYNCED", null);
  });

  // Paket terjadwal diterapkan cron 00:05 tanpa melihat status. Dulu handler
  // selalu memakai siklus AKTIF, sehingga pelanggan ISOLIR/DISMANTLE yang
  // paketnya berganti malam itu dibuka kembali aksesnya di router.
  it.each(["ISOLIR", "NONAKTIF", "MAINTENANCE", "DISMANTLE"])(
    "pelanggan %s tetap diperlakukan sesuai statusnya, tidak diaktifkan",
    async (status) => {
      mockGetPelanggan.mockResolvedValue({ id: "cust-1", status });

      await handlePackageChange(
        buildJob({ ...BASE_PAYLOAD, applyTime: "IMMEDIATE" }),
      );

      expect(mockSyncSingleCustomer).toHaveBeenCalledWith("cust-1");
      expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", status);
      expect(mockHandleStatusChange).not.toHaveBeenCalledWith(
        "cust-1",
        "AKTIF",
      );
    },
  );

  it("pelanggan sudah dihapus → tidak menyentuh router", async () => {
    mockGetPelanggan.mockResolvedValue(null);

    await handlePackageChange(
      buildJob({ ...BASE_PAYLOAD, applyTime: "IMMEDIATE" }),
    );

    expect(mockSyncSingleCustomer).not.toHaveBeenCalled();
    expect(mockHandleStatusChange).not.toHaveBeenCalled();
    expect(mockUpdateSyncStatus).not.toHaveBeenCalled();
  });

  it("NEXT_CYCLE → skip semua operasi MikroTik dan tidak update syncStatus", async () => {
    await handlePackageChange(
      buildJob({ ...BASE_PAYLOAD, applyTime: "NEXT_CYCLE" }),
    );

    expect(mockSyncSingleCustomer).not.toHaveBeenCalled();
    expect(mockHandleStatusChange).not.toHaveBeenCalled();
    expect(mockUpdateSyncStatus).not.toHaveBeenCalled();
  });

  it("gagal sync → mark FAILED + re-throw untuk BullMQ retry", async () => {
    mockSyncSingleCustomer.mockRejectedValueOnce(new Error("MikroTik timeout"));

    await expect(
      handlePackageChange(
        buildJob({ ...BASE_PAYLOAD, applyTime: "IMMEDIATE" }),
      ),
    ).rejects.toThrow("MikroTik timeout");

    expect(mockUpdateSyncStatus).toHaveBeenCalledWith(
      "cust-1",
      "FAILED",
      "MikroTik timeout",
    );
  });

  it("throw kalau customerId bukan string", async () => {
    await expect(
      handlePackageChange(
        buildJob({ ...BASE_PAYLOAD, customerId: 123, applyTime: "IMMEDIATE" }),
      ),
    ).rejects.toThrow(/customerId/);
  });

  it("throw kalau applyTime bukan string", async () => {
    await expect(
      handlePackageChange(buildJob({ ...BASE_PAYLOAD, applyTime: null })),
    ).rejects.toThrow(/applyTime/);
  });
});
