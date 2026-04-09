import { describe, expect, it } from "vitest";

import {
  calculateIncomePeriodCumulativeRoi,
  calculateIncomePeriodExpenseAllocation,
  calculateIncomePeriodNet,
  calculateIncomePeriodRoiDisplayMetrics,
  calculateIncomePeriodSelectedPeriodMetrics,
  parseIncomePeriodNumber,
  type IncomePeriodCalculationFeeConfig,
  type IncomePeriodCalculationRecord,
  type IncomePeriodExpenseItem,
} from "@/app/admin/integrations/mixradius/income-period/calculations";

describe("IncomePeriod calculations", () => {
  it("parses localized rupiah values used by the report", () => {
    expect(parseIncomePeriodNumber("Rp 1.234,56")).toBe(1234.56);
    expect(parseIncomePeriodNumber("1.234.567")).toBe(1234567);
    expect(parseIncomePeriodNumber(2500)).toBe(2500);
    expect(parseIncomePeriodNumber("")).toBe(0);
  });

  it("uses manual fee configuration before online defaults", () => {
    const records: IncomePeriodCalculationRecord[] = [
      {
        total: "100000",
        seller_fee: "5000",
        payment_method: "QRIS",
        payment_type: "online",
        method: "",
      },
    ];

    const feeConfig: IncomePeriodCalculationFeeConfig = {
      QRIS: { type: "FIXED", value: 2500 },
    };

    expect(calculateIncomePeriodNet(records, feeConfig)).toEqual({
      net: 92500,
      fee: 2500,
    });
  });

  it("falls back to Duitku defaults for online methods without manual config", () => {
    const records: IncomePeriodCalculationRecord[] = [
      {
        total: "100000",
        seller_fee: "5000",
        payment_method: "QRIS",
        payment_type: "online",
        method: "",
      },
    ];

    expect(calculateIncomePeriodNet(records, {})).toEqual({
      net: 94300,
      fee: 700,
    });
  });

  it("keeps manual methods without config at zero gateway fee", () => {
    const records: IncomePeriodCalculationRecord[] = [
      {
        total: "100000",
        seller_fee: "5000",
        payment_method: "Tunai Outlet",
        payment_type: "manual",
        method: "MANUAL",
      },
    ];

    expect(calculateIncomePeriodNet(records, {})).toEqual({
      net: 95000,
      fee: 0,
    });
  });

  it("allocates general expenses by transaction and revenue weight", () => {
    const specificExpenses: IncomePeriodExpenseItem[] = [
      { amount: 100000, depreciation: 10000 },
    ];
    const generalExpenses: IncomePeriodExpenseItem[] = [
      { amount: 300000, depreciation: 30000 },
    ];

    expect(
      calculateIncomePeriodExpenseAllocation({
        specificExpenses,
        generalExpenses,
        siteTransactions: "20",
        globalTransactions: "100",
        siteRevenue: "400000",
        globalRevenue: "1000000",
        totalGroups: 5,
      }),
    ).toEqual({
      specificExpenses: 110000,
      allocatedExpenses: 99000,
      totalExpenses: 209000,
    });
  });

  it("falls back to equal general-expense split when global stats are missing", () => {
    const specificExpenses: IncomePeriodExpenseItem[] = [
      { amount: 100000, depreciation: 10000 },
    ];
    const generalExpenses: IncomePeriodExpenseItem[] = [
      { amount: 300000, depreciation: 30000 },
    ];

    expect(
      calculateIncomePeriodExpenseAllocation({
        specificExpenses,
        generalExpenses,
        siteTransactions: null,
        globalTransactions: null,
        siteRevenue: null,
        globalRevenue: null,
        totalGroups: 3,
      }),
    ).toEqual({
      specificExpenses: 110000,
      allocatedExpenses: 110000,
      totalExpenses: 220000,
    });
  });

  it("calculates cumulative ROI breakdown from summary records rab items and categorized expenses", () => {
    const records: IncomePeriodCalculationRecord[] = [
      {
        total: "100000",
        seller_fee: "5000",
        payment_method: "QRIS",
        payment_type: "online",
        method: "",
      },
      {
        total: "200000",
        seller_fee: "10000",
        payment_method: "Tunai Outlet",
        payment_type: "manual",
        method: "MANUAL",
      },
    ];

    expect(
      calculateIncomePeriodCumulativeRoi({
        summaryProfit: "300000",
        summarySellerFee: "15000",
        records,
        feeConfig: {},
        specificExpenses: [
          { amount: 100000, depreciation: 10000, category: "CAPEX" },
          { amount: 50000, depreciation: 5000, category: "OPEX" },
        ],
        generalExpenses: [
          { amount: 60000, depreciation: 6000, category: "CAPEX" },
          { amount: 30000, depreciation: 3000, category: "OPEX" },
        ],
        rabItems: [
          { totalPrice: 400000 },
          { totalPrice: 100000, expenseType: "CAPEX" },
          { totalPrice: 20000, expenseType: "OPEX" },
        ],
        months: 3,
        totalGroups: 3,
      }),
    ).toEqual({
      revenue: 300000,
      sellerFee: 15000,
      gatewayFee: 700,
      capexFromRab: 500000,
      capexUmum: 120000,
      opexAktual: 60000,
      opexUmum: 10000,
      opexProyeksi: 60000,
      depreciation: 18000,
      totalExpenses: 138000,
      operatingProfit: 161300,
    });
  });

  it("uses at least one month for projected opex when months is zero", () => {
    expect(
      calculateIncomePeriodCumulativeRoi({
        summaryProfit: 0,
        summarySellerFee: 0,
        records: [],
        feeConfig: {},
        specificExpenses: [],
        generalExpenses: [],
        rabItems: [{ totalPrice: 25000, expenseType: "OPEX" }],
        months: 0,
        totalGroups: 2,
      }),
    ).toEqual({
      revenue: 0,
      sellerFee: 0,
      gatewayFee: 0,
      capexFromRab: 0,
      capexUmum: 0,
      opexAktual: 0,
      opexUmum: 0,
      opexProyeksi: 25000,
      depreciation: 0,
      totalExpenses: 25000,
      operatingProfit: -25000,
    });
  });

  it("derives ROI and BEP display metrics from cumulative values", () => {
    expect(
      calculateIncomePeriodRoiDisplayMetrics({
        rabItems: [
          { totalPrice: 400000 },
          { totalPrice: 100000, expenseType: "CAPEX" },
          { totalPrice: 20000, expenseType: "OPEX" },
        ],
        totalExpenses: 45000,
        projectedRevenue: 250000,
        projectedOpex: 50000,
        currentProfit: 200000,
        cumulativeNetIncome: 450000,
        cumCapexFromRab: 500000,
        cumCapexUmum: 100000,
        projectMonthsElapsed: 6,
      }),
    ).toEqual({
      totalOpexItems: 20000,
      totalCapex: 600000,
      roiPercent: -25,
      bepReached: false,
      bepProgress: 75,
      revenueProgressPercent: 80,
      revenueProgressWidth: 80,
      opexStatus: "under",
      opexVariancePercent: 10,
      estimatedBepMonthsRemaining: 2,
    });
  });

  it("caps positive ROI/BEP percentages and hides BEP estimate when income is non-positive", () => {
    expect(
      calculateIncomePeriodRoiDisplayMetrics({
        rabItems: [{ totalPrice: 100000, expenseType: "CAPEX" }],
        totalExpenses: 120000,
        projectedRevenue: 100000,
        projectedOpex: 100000,
        currentProfit: 150000,
        cumulativeNetIncome: -5000,
        cumCapexFromRab: 100000,
        cumCapexUmum: 0,
        projectMonthsElapsed: 4,
      }),
    ).toEqual({
      totalOpexItems: 0,
      totalCapex: 100000,
      roiPercent: -105,
      bepReached: false,
      bepProgress: 0,
      revenueProgressPercent: 150,
      revenueProgressWidth: 100,
      opexStatus: "over",
      opexVariancePercent: 20,
      estimatedBepMonthsRemaining: null,
    });
  });

  it("derives selected-period projection metrics from summary target and rab items", () => {
    expect(
      calculateIncomePeriodSelectedPeriodMetrics({
        summaryProfit: "Rp 200.000,50",
        totalRecords: 40,
        targetSubscribers: 50,
        rabItems: [
          { totalPrice: 400000 },
          { totalPrice: 100000, expenseType: "CAPEX" },
          { totalPrice: 20000, expenseType: "OPEX" },
        ],
      }),
    ).toEqual({
      currentProfit: 200000.5,
      capexItemCount: 2,
      targetSubscribersProgressPercent: 80,
      targetSubscribersProgressWidth: 80,
      targetSubscribersProgressTone: "mid",
    });
  });

  it("caps selected-period subscriber progress and falls back safely without target", () => {
    expect(
      calculateIncomePeriodSelectedPeriodMetrics({
        summaryProfit: 0,
        totalRecords: 120,
        targetSubscribers: 0,
        rabItems: [{ totalPrice: 20000, expenseType: "OPEX" }],
      }),
    ).toEqual({
      currentProfit: 0,
      capexItemCount: 0,
      targetSubscribersProgressPercent: 0,
      targetSubscribersProgressWidth: 0,
      targetSubscribersProgressTone: "low",
    });
  });
});
