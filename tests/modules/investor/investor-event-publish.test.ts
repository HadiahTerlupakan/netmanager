import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: mockPublish },
  EVENT_NAMES: {
    INVESTOR_DEPOSIT_REJECTED: "investor:deposit.rejected",
    INVESTOR_PROFIT_SHARE_APPROVED: "investor:profit_share.approved",
  },
}));

import { InvestorDepositService } from "@/modules/investor/services/InvestorDepositService";
import { InvestorProfitShareService } from "@/modules/investor/services/InvestorProfitShareService";

describe("event investor untuk notifikasi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublish.mockResolvedValue(undefined);
  });

  it("menolak setoran mem-publish deposit.rejected beserta alasannya", async () => {
    const depositRepo = {
      findById: vi.fn().mockResolvedValue({ id: "dep-1", status: "PENDING" }),
      updateStatus: vi.fn().mockResolvedValue({
        id: "dep-1",
        investorId: "inv-1",
        tenantId: "t-1",
        amount: 10000000,
      }),
    };
    const service = new InvestorDepositService(depositRepo as never);

    await service.rejectDeposit("dep-1", "Bukti buram");

    expect(mockPublish).toHaveBeenCalledWith("investor:deposit.rejected", {
      depositId: "dep-1",
      investorId: "inv-1",
      tenantId: "t-1",
      amount: "10000000",
      reason: "Bukti buram",
      rejectedAt: expect.any(String),
    });
  });

  it("publish gagal tidak membatalkan penolakan", async () => {
    mockPublish.mockRejectedValue(new Error("bus mati"));
    const depositRepo = {
      findById: vi.fn().mockResolvedValue({ id: "dep-1", status: "PENDING" }),
      updateStatus: vi.fn().mockResolvedValue({ id: "dep-1", investorId: "inv-1", tenantId: null, amount: 1 }),
    };
    await expect(
      new InvestorDepositService(depositRepo as never).rejectDeposit("dep-1", "x"),
    ).resolves.toMatchObject({ id: "dep-1" });
  });

  it("menyetujui bagi hasil mem-publish profit_share.approved dengan periode", async () => {
    const profitShareRepo = {
      findById: vi.fn().mockResolvedValue({ id: "ph-1", status: "CALCULATED" }),
      updateStatus: vi.fn().mockResolvedValue({
        id: "ph-1",
        investorId: "inv-1",
        tenantId: "t-1",
        shareAmount: 2500000,
        capitalReturnAmount: 1000000,
        projectName: "Jaringan Sukamaju",
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-08-31T00:00:00.000Z"),
      }),
    };
    const service = new InvestorProfitShareService(profitShareRepo as never);

    await service.approve("ph-1", "admin-1");

    expect(mockPublish).toHaveBeenCalledWith("investor:profit_share.approved", {
      profitShareId: "ph-1",
      investorId: "inv-1",
      tenantId: "t-1",
      shareAmount: "2500000",
      capitalReturnAmount: "1000000",
      projectName: "Jaringan Sukamaju",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T00:00:00.000Z",
      approvedAt: expect.any(String),
    });
  });
});
