import { describe, expect, it, vi } from "vitest";

import { CashFlowService } from "@/modules/accounting/services/reports/CashFlowService";

/**
 * Arus kas dulu menjumlah akun beban bertanda kategori, sehingga penerimaan
 * pelanggan tidak pernah muncul dan beban tampil positif. Kini baris berasal
 * dari akun lawan mutasi kas (angka ini diverifikasi terhadap Postgres 16
 * dengan jurnal contoh: QRIS ber-biaya, transfer manual, gaji, pencairan).
 */
describe("CashFlowService", () => {
  it("mengelompokkan mutasi kas menurut asal-usulnya", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          coa_code: "1-200",
          coa_name: "Piutang Usaha",
          coa_type: "ASSET",
          cash_flow_category: null,
          cash_in: "111100.00",
        },
        {
          coa_code: "2-600",
          coa_name: "Hutang Investor",
          coa_type: "LIABILITY",
          cash_flow_category: null,
          cash_in: "25000.00",
        },
        {
          coa_code: "5-100",
          coa_name: "Beban Gaji & Upah",
          coa_type: "EXPENSE",
          cash_flow_category: "OPERATING",
          cash_in: "-40000.00",
        },
        {
          coa_code: "5-610",
          coa_name: "Beban Biaya Payment Gateway",
          coa_type: "EXPENSE",
          cash_flow_category: "OPERATING",
          cash_in: "-78.00",
        },
        {
          coa_code: "6-100",
          coa_name: "Pembelian Peralatan Jaringan",
          coa_type: "EXPENSE",
          cash_flow_category: "INVESTING",
          cash_in: "-10000.00",
        },
      ])
      .mockResolvedValueOnce([{ total: "50000.00" }]);

    const report = await new CashFlowService({
      $queryRaw: queryRaw,
    } as never).generate("t1", "2026-10-01", "2026-10-31");

    expect(report.operating.accounts.map((a) => a.coaCode)).toEqual([
      "1-200",
      "5-100",
      "5-610",
    ]);
    expect(Number(report.operating.subtotal)).toBe(71022);
    expect(Number(report.investing.subtotal)).toBe(-10000);
    expect(report.financing.accounts.map((a) => a.coaName)).toEqual([
      "Hutang Investor",
    ]);
    expect(Number(report.netChange)).toBe(86022);
    expect(Number(report.openingCash)).toBe(50000);
    expect(Number(report.closingCash)).toBe(136022);
  });
});
