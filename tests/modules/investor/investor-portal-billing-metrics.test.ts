import { describe, expect, it, vi } from "vitest";

import type { InvestorPortalRepository } from "@/modules/investor/repositories/InvestorPortalRepository";
import { InvestorPortalDashboardService } from "@/modules/investor/services/InvestorPortalDashboardService";
import { InvestorPortalProjectService } from "@/modules/investor/services/InvestorPortalProjectService";

const SITE_ID = "site-1";
const SITE_NAME = "Site Cibubur";
const INVESTOR_ID = "investor-1";
const FUTURE_DUE_DATE = new Date("2999-01-01T00:00:00.000Z");
const PAST_DUE_DATE = new Date("2000-01-01T00:00:00.000Z");

function createInternalCustomers() {
  return [
    {
      siteId: SITE_ID,
      status: "AKTIF",
      idPelanggan: "PLG-001",
      jatuhTempo: FUTURE_DUE_DATE,
      hargaPaket: { harga: 150000 },
    },
    {
      siteId: SITE_ID,
      status: "AKTIF",
      idPelanggan: "PLG-002",
      jatuhTempo: PAST_DUE_DATE,
      hargaPaket: { harga: 200000 },
    },
    {
      siteId: SITE_ID,
      status: "ISOLIR",
      idPelanggan: "PLG-003",
      jatuhTempo: FUTURE_DUE_DATE,
      hargaPaket: { harga: 100000 },
    },
  ];
}

function createInvestorProject(siteId: string | null) {
  return {
    investmentAmount: 10000000n,
    profitSharePercent: 50,
    rabProject: {
      id: siteId ? "project-internal" : "project-tanpa-site",
      name: "Proyek FTTH",
      description: null as string | null,
      status: "PENJUALAN",
      siteId,
      site: siteId ? { name: SITE_NAME } : null,
      projectedRevenue: 5000000n,
      projectedOpex: 50000n,
      contingencyAmount: 0n,
      targetSubscribers: 100,
      growthType: "LINEAR",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      actualAchievements: [] as unknown[],
    },
  };
}

function createRepository(
  projects: ReturnType<typeof createInvestorProject>[],
) {
  return {
    findDashboardProjects: vi.fn().mockResolvedValue(projects),
    findProjectList: vi.fn().mockResolvedValue(projects),
    findProjectDetail: vi.fn().mockResolvedValue(projects[0] ?? null),
    findInternalCustomers: vi.fn().mockResolvedValue(createInternalCustomers()),
  };
}

function asPortalRepository(
  repository: ReturnType<typeof createRepository>,
): InvestorPortalRepository {
  return repository as unknown as InvestorPortalRepository;
}

describe("InvestorPortalProjectService billing metrics", () => {
  it("memakai billing INTERNAL dari pelanggan site untuk proyek dengan siteId", async () => {
    const repository = createRepository([createInvestorProject(SITE_ID)]);
    const service = new InvestorPortalProjectService(
      asPortalRepository(repository),
    );

    const result = await service.getProjectDetail(
      "project-internal",
      INVESTOR_ID,
    );

    expect(repository.findInternalCustomers).toHaveBeenCalledWith([SITE_ID]);
    expect(result).toMatchObject({
      siteName: SITE_NAME,
      billingSource: "INTERNAL",
      estimatedCurrentRevenue: "150000",
      subscribers: { total: 3, active: 2, paying: 1, paymentRatio: 50 },
    });
  });

  it("memakai billing NONE dengan metrik kosong untuk proyek tanpa siteId", async () => {
    const repository = createRepository([createInvestorProject(null)]);
    const service = new InvestorPortalProjectService(
      asPortalRepository(repository),
    );

    const result = await service.getProjectDetail(
      "project-tanpa-site",
      INVESTOR_ID,
    );

    expect(repository.findInternalCustomers).not.toHaveBeenCalled();
    expect(result.siteName).toBeUndefined();
    expect(result).toMatchObject({
      billingSource: "NONE",
      estimatedCurrentRevenue: "0",
      subscribers: { total: 0, active: 0, paying: 0, paymentRatio: 0 },
    });
  });

  it("hanya menambahkan revenue berjalan pada daftar proyek yang punya siteId", async () => {
    const repository = createRepository([
      createInvestorProject(SITE_ID),
      createInvestorProject(null),
    ]);
    const service = new InvestorPortalProjectService(
      asPortalRepository(repository),
    );

    const result = await service.getProjects(INVESTOR_ID);

    expect(repository.findInternalCustomers).toHaveBeenCalledWith([SITE_ID]);
    expect(result.map((project) => project.totalActualRevenue)).toEqual([
      "150000",
      "0",
    ]);
  });
});

describe("InvestorPortalDashboardService billing metrics", () => {
  it("menghitung pelanggan dan revenue aktual hanya dari site internal", async () => {
    const repository = createRepository([
      createInvestorProject(SITE_ID),
      createInvestorProject(null),
    ]);
    const service = new InvestorPortalDashboardService(
      asPortalRepository(repository),
    );

    const result = await service.getDashboard(INVESTOR_ID);

    expect(repository.findInternalCustomers).toHaveBeenCalledWith([SITE_ID]);
    expect(result.subscribers).toEqual({
      total: 3,
      active: 2,
      paying: 1,
      paymentRatio: 50,
    });
    expect(result.totalInvestment).toBe("20000000");
    expect(result.totalActualRevenue).toBe("50000");
  });
});
