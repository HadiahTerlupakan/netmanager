import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prisma: { rabInvestor: { findMany: mockFindMany, findFirst: mockFindFirst } },
}));

import { InvestorPortalRepository } from "@/modules/investor/repositories/InvestorPortalRepository";

const repo = new InvestorPortalRepository();

describe("InvestorPortalRepository — status proyek yang tampil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);
  });

  it("daftar & dashboard hanya proyek yang sudah disetujui ke atas, termasuk target tercapai/selesai", async () => {
    await repo.findProjectList("inv-1", "t-1");
    await repo.findDashboardProjects("inv-1");

    for (const [args] of mockFindMany.mock.calls) {
      expect(args.where.investorId).toBe("inv-1");
      expect(args.where.rabProject.status.in).not.toContain("DRAFT");
      expect(args.where.rabProject.status.in).toEqual(
        expect.arrayContaining(["APPROVED", "PENJUALAN", "TARGET_TERCAPAI", "SELESAI"]),
      );
    }
  });

  it("rincian proyek yang belum disetujui tidak ditemukan", async () => {
    await expect(repo.findProjectDetail("p-1", "inv-1")).resolves.toBeNull();
    expect(mockFindFirst.mock.calls[0][0].where.rabProject.status.in).not.toContain("CANCELLED");
  });

  it("memuat modal semua investor proyek (dasar porsi) beserta item & capaian", async () => {
    await repo.findProjectList("inv-1");
    const include = mockFindMany.mock.calls[0][0].include.rabProject.include;
    expect(include.investors).toEqual({ select: { investmentAmount: true } });
    expect(include.items).toBeDefined();
    expect(include.actualAchievements).toBe(true);
  });
});
