import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, prismaAuth: {} }));

import { InvestorPortalKeuanganService } from "@/modules/investor/services/InvestorPortalKeuanganService";

const depositService = { listByInvestor: vi.fn() };
const balanceService = { getBalance: vi.fn() };
const profitShareService = { listByInvestor: vi.fn() };
const dashboardService = { getDashboard: vi.fn() };

const service = new InvestorPortalKeuanganService(
  depositService as never,
  balanceService as never,
  profitShareService as never,
  dashboardService as never,
);

function bagiHasil(id: string, status: string, shareAmount: number) {
  return {
    id,
    investorId: "inv-1",
    configId: "cfg",
    periodStart: new Date("2026-08-01"),
    periodEnd: new Date("2026-08-31"),
    netProfit: 10_000_000,
    sharePercent: 10,
    shareAmount,
    capitalReturnAmount: 100,
    projectName: "Proyek A",
    status,
    paidAt: null as Date | null,
    journalId: "jurnal-rahasia",
    approvedById: "admin-1",
  };
}

describe("InvestorPortalKeuanganService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ringkasan: siap dibayar = bagi hasil APPROVED + pengembalian modalnya", async () => {
    dashboardService.getDashboard.mockResolvedValue({ totalInvestment: "5000", activeProjectsCount: 1 });
    balanceService.getBalance.mockResolvedValue({ totalDeposit: 5000, activeBalance: 4000 });
    profitShareService.listByInvestor.mockResolvedValue([
      bagiHasil("a", "APPROVED", 300),
      bagiHasil("b", "APPROVED", 200),
      bagiHasil("c", "PAID", 999),
      bagiHasil("d", "CALCULATED", 777),
    ]);

    const hasil = await service.getRingkasan("inv-1", "tenant-1");

    expect(dashboardService.getDashboard).toHaveBeenCalledWith("inv-1", "tenant-1");
    expect(balanceService.getBalance).toHaveBeenCalledWith("inv-1");
    expect(hasil).toEqual({
      totalInvestment: "5000",
      activeProjectsCount: 1,
      balance: { totalDeposit: 5000, activeBalance: 4000 },
      amountAwaitingPayment: 700,
    });
  });

  it("riwayat bagi hasil membuang yang dibatalkan dan field internal", async () => {
    profitShareService.listByInvestor.mockResolvedValue([
      bagiHasil("a", "PAID", 300),
      bagiHasil("b", "CANCELLED", 200),
    ]);

    const hasil = await service.getProfitShares("inv-1");

    expect(hasil.map((share) => share.id)).toEqual(["a"]);
    expect(hasil[0]).toMatchObject({ projectName: "Proyek A", capitalReturnAmount: 100 });
    expect(hasil[0]).not.toHaveProperty("journalId");
    expect(hasil[0]).not.toHaveProperty("approvedById");
  });

  it("riwayat setoran modal hanya memuat field yang boleh dilihat investor", async () => {
    depositService.listByInvestor.mockResolvedValue([
      {
        id: "dep-1",
        amount: 1_000_000,
        depositType: "MODAL_AWAL",
        date: new Date("2026-07-01"),
        status: "COMPLETED",
        reference: "TRF-1",
        rejectedReason: null,
        journalId: "jurnal-rahasia",
        verifiedById: "admin-1",
        proofFileUrl: "https://cdn/bukti.jpg",
      },
    ]);

    const [setoran] = await service.getDeposits("inv-1");

    expect(depositService.listByInvestor).toHaveBeenCalledWith("inv-1");
    expect(Object.keys(setoran).sort()).toEqual(
      ["amount", "date", "depositType", "id", "reference", "rejectedReason", "status"].sort(),
    );
  });
});
