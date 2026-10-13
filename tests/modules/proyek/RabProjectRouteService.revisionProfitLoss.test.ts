import { describe, expect, it, vi } from "vitest";

import { RabProjectRouteService } from "@/modules/proyek";

/**
 * Sengaja TIDAK memock `@/lib/prisma`. Kalau pembacaan realisasi pengeluaran
 * kembali memanggil singleton di `modules/finance/public-queries.ts`, test ini
 * akan menabrak Prisma sungguhan alih-alih memakai lookup palsu di bawah.
 */
const projectWithFinalRevision = {
  id: "rab-1",
  projectedOpex: 20_000n,
  items: [
    {
      id: "item-1",
      name: "ODP",
      totalPrice: 100_000n,
      expenseType: "CAPEX",
    },
  ],
  finalApprovedRevisionId: "rev-2",
  finalApprovedRevision: {
    id: "rev-2",
    totalCapex: 120_000n,
    totalOpex: 25_000n,
    items: [
      {
        id: "rev-item-1",
        rabItemId: "item-1",
        name: "ODP",
        totalPrice: 120_000n,
        quantity: 2,
        unitPrice: 60_000n,
        expenseType: "CAPEX",
      },
    ],
  },
};

const injectedExpenses = [
  {
    id: "exp-1",
    amount: 110_000n,
    category: "CAPEX",
    rabItemId: "item-1",
    description: "Vendor invoice",
  },
  {
    id: "exp-2",
    amount: 20_000n,
    category: "OPEX",
    rabItemId: null,
    description: "Transport",
  },
];

describe("RabProjectRouteService getRevisionProfitLoss", () => {
  it("memakai lookup pengeluaran yang disuntikkan, bukan pintu finance langsung", async () => {
    const repository = {
      findRevisionProfitLossProject: vi
        .fn()
        .mockResolvedValue(projectWithFinalRevision),
    };
    const expenseLookup = vi.fn().mockResolvedValue(injectedExpenses);
    const service = new RabProjectRouteService(
      repository as never,
      expenseLookup as never,
    );

    const result = await service.getRevisionProfitLoss("rab-1");

    expect(expenseLookup).toHaveBeenCalledWith("rab-1");
    expect(result.actualSummary).toEqual({
      capex: "110000",
      opex: "20000",
      total: "130000",
    });
    expect(result.itemVariances[0]).toEqual(
      expect.objectContaining({
        rabItemId: "item-1",
        finalTotal: "120000",
        actualTotal: "110000",
      }),
    );
    expect(result.unmappedRealization).toBe("20000");
  });

  it("melaporkan realisasi nol ketika lookup tidak mengembalikan pengeluaran", async () => {
    const repository = {
      findRevisionProfitLossProject: vi
        .fn()
        .mockResolvedValue(projectWithFinalRevision),
    };
    const expenseLookup = vi.fn().mockResolvedValue([]);
    const service = new RabProjectRouteService(
      repository as never,
      expenseLookup as never,
    );

    const result = await service.getRevisionProfitLoss("rab-1");

    expect(expenseLookup).toHaveBeenCalledTimes(1);
    expect(result.actualSummary.total).toBe("0");
    expect(result.itemVariances[0].actualTotal).toBe("0");
    expect(result.unmappedRealization).toBe("0");
  });
});
