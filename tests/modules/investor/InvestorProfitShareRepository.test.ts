import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    investorProfitShare: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    investor: { findMany: vi.fn() },
  },
}));
const financeQueries = vi.hoisted(() => ({ findRabProjectsForProfitShare: vi.fn() }));

vi.mock("@/lib/prisma", () => db);
vi.mock("@/modules/finance/public-queries", () => financeQueries);

import { InvestorProfitShareRepository } from "@/modules/investor/repositories/InvestorProfitShareRepository";

const repo = new InvestorProfitShareRepository();
const RECORD = {
  id: "ph-1",
  netProfit: 1,
  shareAmount: 2,
  capitalReturnAmount: 3,
  rabProject: { name: "Proyek A" },
};

describe("InvestorProfitShareRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findById & updateStatus menyaring tenantId secara eksplisit", async () => {
    db.prisma.investorProfitShare.findFirst.mockResolvedValue(RECORD);
    db.prisma.investorProfitShare.update.mockResolvedValue(RECORD);

    await expect(repo.findById("ph-1", "t-1")).resolves.toMatchObject({ projectName: "Proyek A" });
    await repo.updateStatus("ph-1", "t-1", { status: "APPROVED" });

    expect(db.prisma.investorProfitShare.findFirst.mock.calls[0][0].where).toEqual({
      id: "ph-1",
      tenantId: "t-1",
    });
    expect(db.prisma.investorProfitShare.update.mock.calls[0][0].where).toEqual({
      id: "ph-1",
      tenantId: "t-1",
    });
  });

  it("bulan dibayar semua investor proyek dibaca dalam satu query dan dikelompokkan", async () => {
    db.prisma.investorProfitShare.findMany.mockResolvedValue([
      { investorId: "inv-a", projectMonths: [1, 2] },
      { investorId: "inv-a", projectMonths: [3] },
      { investorId: "inv-b", projectMonths: [2] },
    ]);

    const hasil = await repo.findPaidProjectMonthsByInvestor("rab-1", ["inv-a", "inv-b", "inv-c"]);

    expect(db.prisma.investorProfitShare.findMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.investorProfitShare.findMany.mock.calls[0][0].where).toEqual({
      rabProjectId: "rab-1",
      investorId: { in: ["inv-a", "inv-b", "inv-c"] },
      status: { not: "CANCELLED" },
    });
    expect(hasil.get("inv-a")).toEqual(new Set([1, 2, 3]));
    expect(hasil.get("inv-b")).toEqual(new Set([2]));
    expect(hasil.has("inv-c")).toBe(false);
  });

  it("tanpa investor tidak menyentuh database", async () => {
    await expect(repo.findPaidProjectMonthsByInvestor("rab-1", [])).resolves.toEqual(new Map());
    expect(db.prisma.investorProfitShare.findMany).not.toHaveBeenCalled();
  });

  it("proyek dari public query finance diperkaya status aktif investor", async () => {
    financeQueries.findRabProjectsForProfitShare.mockResolvedValue([
      {
        id: "rab-1",
        investors: [
          { investorId: "inv-a", investmentAmount: 1n },
          { investorId: "inv-b", investmentAmount: 2n },
        ],
      },
    ]);
    db.prisma.investor.findMany.mockResolvedValue([{ id: "inv-a" }]);

    const [proyek] = await repo.findProjectsForProfitShare("t-1");

    const [tenantId, statuses] = financeQueries.findRabProjectsForProfitShare.mock.calls[0];
    expect(tenantId).toBe("t-1");
    expect(statuses).not.toContain("DRAFT");
    expect(db.prisma.investor.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["inv-a", "inv-b"] },
      isActive: true,
    });
    expect(proyek.investors.map((anggota) => anggota.investor.isActive)).toEqual([true, false]);
  });
});
