import { beforeEach, describe, expect, it, vi } from "vitest";

import { RabInvestorQueryRepository } from "@/modules/finance/repositories/RabInvestorQueryRepository";

const client = {
  rabInvestor: { findMany: vi.fn(), findFirst: vi.fn() },
  rabProject: { findMany: vi.fn() },
};
const repo = new RabInvestorQueryRepository(client as never);
const TERLIHAT = ["APPROVED", "PENJUALAN"] as const;

describe("RabInvestorQueryRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.rabInvestor.findMany.mockResolvedValue([]);
    client.rabInvestor.findFirst.mockResolvedValue(null);
    client.rabProject.findMany.mockResolvedValue([]);
  });

  it("menyaring investor, tenant investor, dan status proyek yang terlihat", async () => {
    await repo.findInvestmentList({ investorId: "inv-1", tenantId: "t-1", visibleStatuses: TERLIHAT });
    await repo.findInvestmentSummaries({ investorId: "inv-1", visibleStatuses: TERLIHAT });

    const [daftar, ringkas] = client.rabInvestor.findMany.mock.calls.map(([args]) => args);
    expect(daftar.where).toEqual({
      investorId: "inv-1",
      investor: { tenantId: "t-1" },
      rabProject: { status: { in: ["APPROVED", "PENJUALAN"] } },
    });
    expect(daftar.orderBy).toEqual({ rabProject: { createdAt: "desc" } });
    expect(ringkas.where).not.toHaveProperty("investor");
  });

  it("memuat modal semua investor proyek (dasar porsi) beserta item & capaian", async () => {
    await repo.findInvestmentList({ investorId: "inv-1", visibleStatuses: TERLIHAT });
    const include = client.rabInvestor.findMany.mock.calls[0][0].include.rabProject.include;
    expect(include.investors).toEqual({ select: { investmentAmount: true } });
    expect(include.items).toBeDefined();
    expect(include.actualAchievements).toBe(true);
  });

  it("rincian dicari per proyek dengan filter akses yang sama", async () => {
    await repo.findInvestmentDetail("p-1", { investorId: "inv-1", visibleStatuses: TERLIHAT });
    expect(client.rabInvestor.findFirst.mock.calls[0][0].where).toMatchObject({
      rabProjectId: "p-1",
      investorId: "inv-1",
    });
  });

  it("proyek bagi hasil: tenant, status, punya investor; tanpa join tabel investor", async () => {
    await repo.findProjectsForProfitShare("t-1", TERLIHAT);
    const args = client.rabProject.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      tenantId: "t-1",
      status: { in: ["APPROVED", "PENJUALAN"] },
      investors: { some: {} },
    });
    expect(args.include.investors).toEqual({ select: { investorId: true, investmentAmount: true } });
    expect(args.orderBy).toEqual({ createdAt: "asc" });
  });
});
