import { describe, expect, it, vi } from "vitest";

import { MobileMitraRouteService } from "@/modules/mitra/services/MobileMitraRouteService";

const walletService = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getEarningsSummary: vi.fn(),
  getTransactions: vi.fn(),
  countMonthlyEarningsByDescription: vi.fn(),
}));

vi.mock(
  "@/modules/mitra/services/MitraWalletService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/mitra/services/MitraWalletService")
    >()),
    getMitraWalletService: () => walletService,
  }),
);

describe("MobileMitraRouteService", () => {
  it("mengirim dashboard mobile dengan total pendapatan dari wallet dan key fee lama bernilai netral", async () => {
    const mitraRepository = {
      findByIdSimple: vi.fn().mockResolvedValue({
        id: "mitra-1",
        isActive: true,
        mitraType: "MITRA_SALES",
        mitraRateWoPsb: null,
        mitraRateWoMaintenance: null,
        mitraRateCanvasing: 25_000,
        minWithdrawal: 50_000,
        targetHarian: 10,
      }),
      countPendingWithdrawals: vi.fn().mockResolvedValue(1),
    };
    const dashboardRepository = {
      countAssignedMitraWorkOrders: vi.fn().mockResolvedValue(2),
      countPendingMitraWorkOrders: vi.fn().mockResolvedValue(1),
      countClosedMitraWorkOrders: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4),
    };
    walletService.getBalance.mockResolvedValue({
      success: true,
      data: {
        balance: 250_000,
        totalEarnings: 750_000,
        totalWithdrawn: 500_000,
      },
    });
    walletService.getEarningsSummary.mockResolvedValue({
      success: true,
      data: { earningsThisMonth: 100_000 },
    });
    walletService.getTransactions.mockResolvedValue({
      success: true,
      data: { transactions: [], total: 0 },
    });
    walletService.countMonthlyEarningsByDescription.mockResolvedValue({
      success: true,
      data: 6,
    });
    const service = new MobileMitraRouteService(
      mitraRepository as never,
      {} as never,
      dashboardRepository as never,
    );

    const result = await service.getDashboard({
      id: "mitra-1",
      tenantId: "tenant-1",
      role: "MITRA",
    });

    expect(result).toEqual({
      success: true,
      data: {
        employeeType: "MITRA_SALES",
        ratePsb: null,
        rateMaintenance: null,
        rateCanvasing: 25_000,
        minWithdrawal: 50_000,
        balance: 250_000,
        totalEarnings: 750_000,
        totalWithdrawn: 500_000,
        completedJobsThisMonth: 6,
        workOrdersAssigned: 2,
        pendingTickets: 1,
        woCompletedToday: 1,
        woCompletedWeek: 3,
        woCompletedMonth: 4,
        activeCustomers: 0,
        totalActiveCustomers: 0,
        targetHarian: 10,
        enableFeePelanggan: false,
        pendingWithdrawals: 1,
        monthlyEarnings: { earningsThisMonth: 100_000 },
        recentTransactions: [],
      },
    });
  });
});
