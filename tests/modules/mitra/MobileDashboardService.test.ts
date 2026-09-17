import { describe, expect, it, vi } from "vitest";

import { MobileDashboardService } from "@/modules/mitra";

const periods = {
  today: new Date("2026-04-27T00:00:00.000Z"),
  weekStart: new Date("2026-04-27T00:00:00.000Z"),
  monthStart: new Date("2026-04-01T00:00:00.000Z"),
};

describe("MobileDashboardService", () => {
  it("membangun dashboard mitra sales dengan saldo komisi dari wallet saja", async () => {
    const repository = {
      findMitraDashboardProfile: vi.fn().mockResolvedValue({
        siteId: "site-1",
        mitraType: "MITRA_SALES",
        targetHarian: 10,
        currentBalance: 5_000,
      }),
      countAssignedMitraWorkOrders: vi.fn().mockResolvedValue(2),
      countClosedMitraWorkOrders: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4),
      countMitraClosingMonth: vi.fn().mockResolvedValue(0),
    };
    const service = new MobileDashboardService(
      repository as never,
      () => periods,
    );

    const result = await service.getDashboardStats({
      id: "mitra-1",
      role: "MITRA",
      tenantId: "tenant-1",
    });

    expect(repository.countAssignedMitraWorkOrders).toHaveBeenCalledWith({
      userId: "mitra-1",
      tenantId: "tenant-1",
    });
    expect(result).toEqual({
      workOrdersAssigned: 2,
      workOrdersPending: 0,
      woCompletedToday: 1,
      woCompletedWeek: 3,
      woCompletedMonth: 4,
      barangKeluarToday: 0,
      barangMasukToday: 0,
      targetHarian: 10,
      suksesClosingMonth: 0,
      saldoKomisi: 5_000,
      activeCustomers: 0,
      enableFeePelanggan: false,
    });
  });

  it("membangun dashboard employee dengan akses site dan target canvasing", async () => {
    const repository = {
      findEmployeeDashboardProfile: vi.fn().mockResolvedValue({
        siteId: "site-1",
        departmentId: "dept-1",
        userSites: [{ siteId: "site-2" }],
        canvasingTarget: 12,
        targetSchema: "MONTHLY_RESET",
      }),
      countAssignedEmployeeWorkOrders: vi.fn().mockResolvedValue(2),
      countPendingEmployeeWorkOrders: vi.fn().mockResolvedValue(5),
      countClosedEmployeeWorkOrders: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4),
      countBarangKeluarToday: vi.fn().mockResolvedValue(6),
      countBarangMasukToday: vi.fn().mockResolvedValue(7),
      countMonthlyCanvasing: vi.fn().mockResolvedValue(8),
    };
    const service = new MobileDashboardService(
      repository as never,
      () => periods,
    );

    const result = await service.getDashboardStats({
      id: "user-1",
      role: "KARYAWAN",
      tenantId: "tenant-1",
    });

    expect(repository.countPendingEmployeeWorkOrders).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      departmentId: "dept-1",
      userSiteIds: ["site-2"],
    });
    expect(result).toEqual({
      workOrdersAssigned: 2,
      workOrdersPending: 5,
      woCompletedToday: 1,
      woCompletedWeek: 3,
      woCompletedMonth: 4,
      barangKeluarToday: 6,
      barangMasukToday: 7,
      unclaimedCanvasing: 8,
      canvasingTarget: 12,
      targetSchema: "MONTHLY_RESET",
    });
  });
});
