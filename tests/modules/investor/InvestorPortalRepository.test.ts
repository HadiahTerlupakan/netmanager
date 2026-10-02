import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prisma: { rabInvestor: { findMany: mockFindMany, findFirst: mockFindFirst } },
}));

import { InvestorPortalRepository } from "@/modules/investor/repositories/InvestorPortalRepository";

const repo = new InvestorPortalRepository();

function baris(modal: bigint, semuaModal: bigint[], persenProyek = 50) {
  return {
    investmentAmount: modal,
    profitSharePercent: persenProyek,
    rabProject: { investors: semuaModal.map((investmentAmount) => ({ investmentAmount })) },
  };
}

describe("InvestorPortalRepository — porsi & status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daftar proyek hanya status yang sudah disetujui dan persen dibagi sesuai porsi modal", async () => {
    mockFindMany.mockResolvedValue([baris(50n, [50n, 50n])]);

    const [proyek] = await repo.findProjectList("inv-1", "t-1");

    expect(proyek.profitSharePercent).toBe(25);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.investorId).toBe("inv-1");
    expect(where.rabProject.status.in).not.toContain("DRAFT");
    expect(where.rabProject.status.in).toContain("APPROVED");
  });

  it("rincian proyek yang belum disetujui tidak ditemukan; yang ada ikut porsi", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(repo.findProjectDetail("p-1", "inv-1")).resolves.toBeNull();
    expect(mockFindFirst.mock.calls[0][0].where.rabProject.status.in).not.toContain("CANCELLED");

    mockFindFirst.mockResolvedValueOnce(baris(30n, [30n, 70n]));
    await expect(repo.findProjectDetail("p-1", "inv-1")).resolves.toMatchObject({ profitSharePercent: 15 });
  });

  it("dashboard memakai aturan yang sama", async () => {
    mockFindMany.mockResolvedValue([baris(10n, [10n])]);
    const [proyek] = await repo.findDashboardProjects("inv-1");
    expect(proyek.profitSharePercent).toBe(50);
    expect(mockFindMany.mock.calls[0][0].where.rabProject.status.in).toContain("PENJUALAN");
  });
});
