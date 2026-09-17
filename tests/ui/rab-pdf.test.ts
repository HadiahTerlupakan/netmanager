import { describe, expect, it } from "vitest";

import {
  buildRABPdfTrackingTable,
  getRABPdfDocumentOptions,
} from "@/app/admin/pengeluaran/rab-pdf";
import type { RABProject } from "@/app/admin/pengeluaran/rabTypes";

const project: RABProject = {
  id: "rab-pdf-revenue-split",
  name: "RAB PDF Revenue Split Test",
  projectedRevenue: 1_000_000,
  projectedOpex: 100_000,
  targetSubscribers: 100,
  arpu: 10_000,
  growthType: "LINEAR",
  paymentType: "PREPAID",
  growthSettings: { subscribersPerMonth: 100 },
  nplTolerancePercent: 20,
  investmentDurationMonths: 1,
  investmentRecoveryType: "PERCENTAGE",
  investmentRecoveryValue: 50,
  investorProfitSharePercent: 50,
  status: "DRAFT",
  items: [
    {
      id: "item-capex",
      name: "CAPEX test",
      category: "Investasi",
      quantity: 1,
      unitPrice: 1_000_000,
      totalPrice: 1_000_000,
      expenseType: "CAPEX",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function normalizeCurrencyCells(cells: string[]): string[] {
  return cells.map((cell) => cell.replace(/ /g, " "));
}

describe("getRABPdfDocumentOptions", () => {
  it("memakai A4 landscape agar tabel investor muat", () => {
    expect(getRABPdfDocumentOptions()).toEqual({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
  });
});

describe("buildRABPdfTrackingTable", () => {
  it("memisahkan gross revenue, npl, net revenue, dan opex untuk PDF investor", () => {
    const table = buildRABPdfTrackingTable(project);

    expect(table.head).toEqual([
      [
        "Bulan",
        "Gross Revenue",
        "Potensi NPL",
        "Net Revenue",
        "OPEX",
        "Profit Kotor",
        "Angsuran Modal",
        "Sisa Investasi",
        "Investor",
        "Company",
      ],
    ]);
    expect(normalizeCurrencyCells(table.body[0])).toEqual([
      "1",
      "Rp 1.000.000",
      "Rp 200.000",
      "Rp 800.000",
      "Rp 100.000",
      "Rp 700.000",
      "Rp 350.000",
      "Rp 650.000",
      "Rp 175.000",
      "Rp 175.000",
    ]);
    expect(table.foot.map(normalizeCurrencyCells)).toEqual([
      [
        "TOTAL",
        "Rp 1.000.000",
        "Rp 200.000",
        "Rp 800.000",
        "Rp 100.000",
        "Rp 700.000",
        "Rp 350.000",
        "",
        "Rp 175.000",
        "Rp 175.000",
      ],
    ]);
  });

  it("menyediakan ringkasan buffer opex untuk PDF investor", () => {
    const table = buildRABPdfTrackingTable({
      ...project,
      projectedOpex: 500_000,
      growthSettings: { subscribersPerMonth: 50 },
      investmentDurationMonths: 2,
      opexBufferFundingMode: "SHARED_PERCENTAGE",
      opexBufferInvestorPercent: 60,
      opexBufferCompanyPercent: 40,
      opexBufferSafetyPercent: 10,
    });

    expect(table.totals.opexBufferTotal).toBe(110_000);
    expect(table.totals.opexBufferInvestorShare).toBe(66_000);
    expect(table.totals.initialFundingNeed).toBe(1_066_000);
    expect(table.totals.investorDepositTotal).toBe(1_066_000);
    expect(table.fundingSummary).toContainEqual([
      "Durasi Buffer Otomatis",
      "Buffer menutup gap OPEX selama 1 bulan (bulan ke-1)",
    ]);
    expect(table.fundingSummary.map((row) => row[0])).not.toContain(
      "Total Setoran Investor",
    );
    expect(table.fundingSummary.map(normalizeCurrencyCells)).toContainEqual([
      "Total Dana Investor Direcovery",
      "Rp 1.066.000",
    ]);
  });
});
