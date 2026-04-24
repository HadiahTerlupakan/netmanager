import { describe, expect, it } from "vitest";

import { buildRABCsvContent } from "@/app/admin/integrations/mixradius/expenses/rab-csv";
import type { RABProject } from "@/app/admin/integrations/mixradius/expenses/rabTypes";

describe("buildRABCsvContent", () => {
  it("menetralkan formula spreadsheet pada cell string yang diekspor", () => {
    const project: RABProject = {
      id: "rab-csv-1",
      name: "RAB CSV Test",
      projectedRevenue: 1_000_000,
      projectedOpex: 100_000,
      targetSubscribers: 100,
      arpu: 10_000,
      growthType: "LINEAR",
      paymentType: "PREPAID",
      growthSettings: { subscribersPerMonth: 100 },
      nplTolerancePercent: 10,
      investmentDurationMonths: 2,
      investmentRecoveryType: "PERCENTAGE",
      investmentRecoveryValue: 50,
      investorProfitSharePercent: 50,
      status: "DRAFT",
      items: [
        {
          id: "item-1",
          name: "=SUM(A1:A2)",
          category: "@Kategori",
          quantity: 1,
          unitPrice: 500_000,
          totalPrice: 500_000,
          expenseType: "CAPEX",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const csvContent = buildRABCsvContent(project);

    expect(csvContent).toContain('"\'=SUM(A1:A2)"');
    expect(csvContent).toContain('"\'@Kategori"');
  });
});
