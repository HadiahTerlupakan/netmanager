import { describe, expect, it, vi } from "vitest";

import { handleCustomerStatusChange } from "@/modules/network/services/radius-sync-status.helpers";

function deps(disconnect: { success: boolean; error?: string } | null) {
  return {
    networkRepo: {
      findPelangganBasic: vi.fn().mockResolvedValue({ id: "p1" }),
    },
    radiusRepo: { syncPelangganToRadius: vi.fn().mockResolvedValue(undefined) },
    pppSecretService: {
      syncNewCustomer: vi.fn(),
      unIsolateCustomer: vi.fn(),
      isolateCustomer: vi.fn(),
      dismantleCustomer: vi.fn(),
      disconnectCustomer: vi
        .fn()
        .mockResolvedValue(
          disconnect && {
            ...disconnect,
            disconnected: disconnect.success ? 1 : 0,
          },
        ),
    },
  };
}

describe("handleCustomerStatusChange mode RADIUS", () => {
  it.each(["ISOLIR", "AKTIF", "NONAKTIF", "DISMANTLE"] as const)(
    "%s: tulis RADIUS lalu putus sesi agar status baru berlaku saat login ulang",
    async (status) => {
      const d = deps({ success: true });

      await handleCustomerStatusChange({
        pelangganId: "p1",
        newStatus: status,
        mode: "RADIUS",
        ...d,
      });

      expect(d.radiusRepo.syncPelangganToRadius).toHaveBeenCalledWith("p1");
      expect(d.pppSecretService.disconnectCustomer).toHaveBeenCalledWith("p1");
      expect(d.pppSecretService.isolateCustomer).not.toHaveBeenCalled();
      expect(d.pppSecretService.unIsolateCustomer).not.toHaveBeenCalled();
      expect(d.pppSecretService.dismantleCustomer).not.toHaveBeenCalled();
    },
  );

  it("gagal memutus sesi dilempar agar worker mencoba lagi", async () => {
    const d = deps({ success: false, error: "router tidak terjangkau" });

    await expect(
      handleCustomerStatusChange({
        pelangganId: "p1",
        newStatus: "ISOLIR",
        mode: "RADIUS",
        ...d,
      }),
    ).rejects.toThrow("router tidak terjangkau");
  });

  it("pelanggan tanpa router tujuan tidak dianggap gagal", async () => {
    const d = deps(null);

    await expect(
      handleCustomerStatusChange({
        pelangganId: "p1",
        newStatus: "ISOLIR",
        mode: "RADIUS",
        ...d,
      }),
    ).resolves.toBeUndefined();
  });
});
