import { beforeEach, describe, expect, it, vi } from "vitest";

const financeQueries = vi.hoisted(() => ({
  findRabInvestmentSummaries: vi.fn(),
  findRabInvestmentList: vi.fn(),
  findRabInvestmentDetail: vi.fn(),
}));

vi.mock("@/modules/finance/public-queries", () => financeQueries);
vi.mock("@/modules/database", () => ({ prisma: {} }));

import { InvestorPortalRepository } from "@/modules/investor/repositories/InvestorPortalRepository";

const repo = new InvestorPortalRepository();

describe("InvestorPortalRepository — proyek RAB dibaca lewat public query finance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    financeQueries.findRabInvestmentSummaries.mockResolvedValue([]);
    financeQueries.findRabInvestmentList.mockResolvedValue([]);
    financeQueries.findRabInvestmentDetail.mockResolvedValue(null);
  });

  it("daftar & dashboard hanya proyek yang sudah disetujui ke atas, termasuk target tercapai/selesai", async () => {
    await repo.findProjectList("inv-1", "t-1");
    await repo.findDashboardProjects("inv-1");

    const filters = [
      financeQueries.findRabInvestmentList.mock.calls[0][0],
      financeQueries.findRabInvestmentSummaries.mock.calls[0][0],
    ];
    expect(filters[0]).toMatchObject({ investorId: "inv-1", tenantId: "t-1" });
    expect(filters[1]).toMatchObject({ investorId: "inv-1", tenantId: undefined });
    for (const filter of filters) {
      expect(filter.visibleStatuses).not.toContain("DRAFT");
      expect(filter.visibleStatuses).toEqual(
        expect.arrayContaining(["APPROVED", "PENJUALAN", "TARGET_TERCAPAI", "SELESAI"]),
      );
    }
  });

  it("rincian proyek yang belum disetujui tidak ditemukan", async () => {
    await expect(repo.findProjectDetail("p-1", "inv-1")).resolves.toBeNull();
    const [projectId, filter] = financeQueries.findRabInvestmentDetail.mock.calls[0];
    expect(projectId).toBe("p-1");
    expect(filter.visibleStatuses).not.toContain("CANCELLED");
  });
});
