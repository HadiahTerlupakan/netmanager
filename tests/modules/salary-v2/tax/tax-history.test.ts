import { describe, it, expect } from "vitest";
import { InMemoryTaxHistoryProvider } from "@/modules/salary-v2/tax/providers/TaxHistoryProvider";
import type { MonthlyTaxRecord } from "@/modules/salary-v2/tax/providers/TaxHistoryProvider";

describe("TaxHistoryProvider", () => {
  it("should return empty history for new employee", () => {
    const provider = new InMemoryTaxHistoryProvider([]);
    const history = provider.getYtdHistory("user-1", 2026);
    expect(history.records).toHaveLength(0);
    expect(history.totalGrossIncome).toBe(0);
    expect(history.totalTaxPaid).toBe(0);
    expect(history.totalBiayaJabatan).toBe(0);
    expect(history.totalBpjsEmployee).toBe(0);
    expect(history.monthsWorked).toBe(0);
  });

  it("should aggregate YTD totals from records", () => {
    const records: MonthlyTaxRecord[] = [
      {
        userId: "user-1",
        year: 2026,
        month: 1,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      },
      {
        userId: "user-1",
        year: 2026,
        month: 2,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      },
      {
        userId: "user-1",
        year: 2026,
        month: 3,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      },
    ];
    const provider = new InMemoryTaxHistoryProvider(records);
    const history = provider.getYtdHistory("user-1", 2026);

    expect(history.records).toHaveLength(3);
    expect(history.totalGrossIncome).toBe(30000000);
    expect(history.totalTaxPaid).toBe(600000);
    expect(history.totalBiayaJabatan).toBe(1500000);
    expect(history.totalBpjsEmployee).toBe(960000);
    expect(history.monthsWorked).toBe(3);
  });

  it("should filter by user and year", () => {
    const records: MonthlyTaxRecord[] = [
      {
        userId: "user-1",
        year: 2026,
        month: 1,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      },
      {
        userId: "user-2",
        year: 2026,
        month: 1,
        grossIncome: 8000000,
        taxPaid: 150000,
        biayaJabatan: 400000,
        bpjsEmployee: 240000,
      },
      {
        userId: "user-1",
        year: 2025,
        month: 12,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      },
    ];
    const provider = new InMemoryTaxHistoryProvider(records);
    const history = provider.getYtdHistory("user-1", 2026);

    expect(history.records).toHaveLength(1);
    expect(history.totalGrossIncome).toBe(10000000);
  });
});
