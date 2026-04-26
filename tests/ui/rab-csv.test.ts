import { describe, expect, it } from "vitest";

import { buildRABCsvContent } from "@/app/admin/integrations/mixradius/expenses/rab-csv";
import type { RABProject } from "@/app/admin/integrations/mixradius/expenses/rabTypes";

describe("buildRABCsvContent", () => {
  it("memisahkan gross revenue, npl, dan net revenue untuk export investor", () => {
    const project: RABProject = {
      id: "rab-csv-revenue-split",
      name: "RAB Revenue Split Test",
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

    const csvContent = buildRABCsvContent(project);

    expect(csvContent).toContain(
      '"Bulan ke","Gross Revenue","Potensi NPL","Net Revenue","OPEX","Profit Kotor","Angsuran Modal","Sisa Investasi","Investor Share","Company Share"',
    );
    expect(csvContent).toContain(
      '"1","1000000","200000","800000","100000","700000","350000","650000","175000","175000"',
    );
    expect(csvContent).toContain(
      '"TOTAL AKUMULASI","1000000","200000","800000","100000","700000","350000","","175000","175000"',
    );
  });

  it("menyertakan ringkasan buffer opex ramp-up untuk investor", () => {
    const project: RABProject = {
      id: "rab-csv-opex-buffer",
      name: "RAB CSV OPEX Buffer Test",
      projectedRevenue: 1_000_000,
      projectedOpex: 500_000,
      targetSubscribers: 100,
      arpu: 10_000,
      growthType: "LINEAR",
      paymentType: "PREPAID",
      growthSettings: { subscribersPerMonth: 50 },
      nplTolerancePercent: 20,
      investmentDurationMonths: 2,
      investmentRecoveryType: "PERCENTAGE",
      investmentRecoveryValue: 50,
      investorProfitSharePercent: 50,
      opexBufferFundingMode: "SHARED_PERCENTAGE",
      opexBufferInvestorPercent: 60,
      opexBufferCompanyPercent: 40,
      opexBufferSafetyPercent: 10,
      status: "DRAFT",
      items: [
        {
          id: "item-capex",
          name: "CAPEX test",
          quantity: 1,
          unitPrice: 1_000_000,
          totalPrice: 1_000_000,
          expenseType: "CAPEX",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const csvContent = buildRABCsvContent(project);

    expect(csvContent).toContain('"BUFFER OPEX RAMP-UP"');
    expect(csvContent).toContain('"Gap OPEX Dasar","100000"');
    expect(csvContent).toContain('"Total Buffer OPEX","110000"');
    expect(csvContent).toContain(
      '"Durasi Buffer Otomatis","Buffer menutup gap OPEX selama 1 bulan (bulan ke-1)"',
    );
    expect(csvContent).toContain('"Porsi Investor","66000"');
    expect(csvContent).toContain('"Porsi Perusahaan","44000"');
    expect(csvContent).toContain('"Total Setoran Investor","1066000"');
    expect(csvContent).toContain('"Total Dana Investor Direcovery","1066000"');
    expect(csvContent.indexOf('"Total Setoran Investor"')).toBeLessThan(
      csvContent.indexOf('"BUFFER OPEX RAMP-UP"'),
    );
  });

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

  it("mempertahankan angka negatif sebagai numerik di CSV", () => {
    const project: RABProject = {
      id: "rab-csv-2",
      name: "RAB CSV Negative Number Test",
      projectedRevenue: 0,
      projectedOpex: 100_000,
      targetSubscribers: 0,
      arpu: 0,
      growthType: "LINEAR",
      paymentType: "PREPAID",
      growthSettings: { subscribersPerMonth: 0 },
      nplTolerancePercent: 0,
      investmentDurationMonths: 1,
      investmentRecoveryType: "PERCENTAGE",
      investmentRecoveryValue: 50,
      investorProfitSharePercent: 50,
      status: "DRAFT",
      items: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const csvContent = buildRABCsvContent(project);

    expect(csvContent).toContain(
      '"1","0","0","0","100000","-100000","0","100000","0","0"',
    );
    expect(csvContent).not.toContain('"\'-100000"');
  });
});
