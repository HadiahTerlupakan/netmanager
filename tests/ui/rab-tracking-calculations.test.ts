import { describe, expect, it } from "vitest";

import {
  calculateMonthlySubscribers,
  calculateRealisticBEP,
} from "@/app/admin/integrations/mixradius/expenses/rabCalculations";
import { buildRABTrackingDataset } from "@/app/admin/integrations/mixradius/expenses/rabTracking";
import type {
  RABActualAchievement,
  RABProject,
} from "@/app/admin/integrations/mixradius/expenses/rabTypes";

describe("rab tracking calculations helpers", () => {
  const createBaseProject = (): RABProject => ({
    id: "rab-tracking",
    name: "RAB Tracking Test",
    projectedRevenue: 1_000_000,
    projectedOpex: 100_000,
    targetSubscribers: 100,
    arpu: 10_000,
    growthType: "LINEAR",
    paymentType: "POSTPAID",
    growthSettings: { subscribersPerMonth: 50 },
    nplTolerancePercent: 20,
    investmentDurationMonths: 3,
    investmentRecoveryType: "PERCENTAGE",
    investmentRecoveryValue: 50,
    investorProfitSharePercent: 50,
    status: "DRAFT",
    items: [
      {
        id: "item-1",
        name: "Tower",
        quantity: 1,
        unitPrice: 1_000_000,
        totalPrice: 1_000_000,
        expenseType: "CAPEX",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("menggunakan helper calculateMonthlySubscribers dari modul baru", () => {
    const result = calculateMonthlySubscribers(
      100,
      "LINEAR",
      { subscribersPerMonth: 25 },
      5,
    );

    expect(result).toEqual([25, 50, 75, 100, 100]);
  });

  it("menghitung growth percentage dengan pola helper shared", () => {
    const result = calculateMonthlySubscribers(
      100,
      "PERCENTAGE",
      { initialPercent: 10, monthlyGrowthPercent: 20 },
      5,
    );

    expect(result).toEqual([10, 30, 50, 70, 90]);
  });

  it("menginterpolasi custom milestone secara konsisten", () => {
    const result = calculateMonthlySubscribers(
      100,
      "CUSTOM",
      {
        milestones: [
          { month: 3, percent: 30 },
          { month: 6, percent: 60 },
        ],
      },
      6,
    );

    expect(result).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("menggunakan helper calculateRealisticBEP dari modul baru", () => {
    const project: RABProject = {
      id: "rab-1",
      name: "RAB Test",
      projectedRevenue: 1_000_000,
      projectedOpex: 200_000,
      targetSubscribers: 100,
      arpu: 10_000,
      growthType: "LINEAR",
      paymentType: "PREPAID",
      growthSettings: { subscribersPerMonth: 100 },
      status: "DRAFT",
      items: [
        {
          id: "item-1",
          name: "Tower",
          quantity: 1,
          unitPrice: 500_000,
          totalPrice: 500_000,
          expenseType: "CAPEX",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = calculateRealisticBEP(project);

    expect(result.bepMonth).toBe(1);
    expect(result.monthsToFullCapacity).toBe(1);
    expect(result.simpleBep).toBeGreaterThan(0);
  });

  it("menghitung BEP postpaid memakai subscriber billing bulan sebelumnya", () => {
    const project: RABProject = {
      id: "rab-2",
      name: "RAB Postpaid Test",
      projectedRevenue: 1_000_000,
      projectedOpex: 100_000,
      targetSubscribers: 100,
      arpu: 10_000,
      growthType: "LINEAR",
      paymentType: "POSTPAID",
      growthSettings: { subscribersPerMonth: 100 },
      status: "DRAFT",
      items: [
        {
          id: "item-1",
          name: "Tower",
          quantity: 1,
          unitPrice: 500_000,
          totalPrice: 500_000,
          expenseType: "CAPEX",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = calculateRealisticBEP(project);

    expect(result.bepMonth).toBe(2);
    expect(result.monthsToFullCapacity).toBe(1);
  });

  it("konsisten memakai fallback revenue proyeksi aware NPL untuk row dan summary", () => {
    const dataset = buildRABTrackingDataset(createBaseProject(), []);

    expect(dataset.rows).toHaveLength(3);

    expect(dataset.rows[0].grossTargetRevenue).toBe(0);
    expect(dataset.rows[0].projectedRevenue).toBe(0);
    expect(dataset.rows[0].nplAmount).toBe(0);

    expect(dataset.rows[1].grossTargetRevenue).toBe(500_000);
    expect(dataset.rows[1].projectedRevenue).toBe(400_000);
    expect(dataset.rows[1].nplAmount).toBe(100_000);
    expect(dataset.rows[1].displayRevenue).toBe(400_000);

    expect(dataset.rows[2].grossTargetRevenue).toBe(1_000_000);
    expect(dataset.rows[2].projectedRevenue).toBe(800_000);
    expect(dataset.rows[2].nplAmount).toBe(200_000);

    const revenueFromRows = dataset.rows.reduce(
      (sum, row) => sum + row.displayRevenue,
      0,
    );
    const nplFromRows = dataset.rows.reduce(
      (sum, row) => sum + row.nplAmount,
      0,
    );

    expect(dataset.totals.revenue).toBe(revenueFromRows);
    expect(dataset.totals.nplAmount).toBe(nplFromRows);
    expect(dataset.totals.grossRevenue).toBe(1_500_000);
    expect(dataset.totals.revenue).toBe(1_200_000);
    expect(dataset.totals.nplAmount).toBe(300_000);
    expect(dataset.totals.opex).toBe(300_000);
  });

  it("menghitung buffer opex dari gap ramp-up dan membaginya persen investor/perusahaan", () => {
    const project = {
      ...createBaseProject(),
      projectedOpex: 500_000,
      paymentType: "PREPAID" as const,
      opexBufferFundingMode: "SHARED_PERCENTAGE" as const,
      opexBufferInvestorPercent: 60,
      opexBufferCompanyPercent: 40,
      opexBufferSafetyPercent: 10,
    };

    const dataset = buildRABTrackingDataset(project, []);

    expect(dataset.rows[0].opexGap).toBe(100_000);
    expect(dataset.rows[1].opexGap).toBe(0);
    expect(dataset.rows[2].opexGap).toBe(0);
    expect(dataset.totals.opexBufferBase).toBe(100_000);
    expect(dataset.totals.opexBufferSafety).toBe(10_000);
    expect(dataset.totals.opexBufferTotal).toBe(110_000);
    expect(dataset.totals.opexBufferInvestorShare).toBe(66_000);
    expect(dataset.totals.opexBufferCompanyShare).toBe(44_000);
    expect(dataset.totals.opexBufferDurationMonths).toBe(1);
    expect(dataset.totals.opexBufferCoveredMonths).toEqual([1]);
    expect(dataset.totals.opexBufferDurationLabel).toBe(
      "Buffer menutup gap OPEX selama 1 bulan (bulan ke-1)",
    );
    expect(dataset.totals.initialFundingNeed).toBe(1_066_000);
    expect(dataset.totals.investorDepositTotal).toBe(1_066_000);
  });

  it("mendukung buffer opex fixed investor dan sisa perusahaan", () => {
    const project = {
      ...createBaseProject(),
      projectedOpex: 500_000,
      paymentType: "PREPAID" as const,
      opexBufferFundingMode: "FIXED" as const,
      opexBufferInvestorFixedAmount: 25_000,
    };

    const dataset = buildRABTrackingDataset(project, []);

    expect(dataset.totals.opexBufferTotal).toBe(100_000);
    expect(dataset.totals.opexBufferInvestorShare).toBe(25_000);
    expect(dataset.totals.opexBufferCompanyShare).toBe(75_000);
    expect(dataset.totals.initialFundingNeed).toBe(1_025_000);
  });

  it("mendukung buffer opex investor penuh", () => {
    const project = {
      ...createBaseProject(),
      projectedOpex: 500_000,
      paymentType: "PREPAID" as const,
      opexBufferFundingMode: "INVESTOR" as const,
    };

    const dataset = buildRABTrackingDataset(project, []);

    expect(dataset.totals.opexBufferTotal).toBe(100_000);
    expect(dataset.totals.opexBufferInvestorShare).toBe(100_000);
    expect(dataset.totals.opexBufferCompanyShare).toBe(0);
    expect(dataset.totals.initialFundingNeed).toBe(1_100_000);
  });

  it("mendukung buffer opex perusahaan penuh", () => {
    const project = {
      ...createBaseProject(),
      projectedOpex: 500_000,
      paymentType: "PREPAID" as const,
      opexBufferFundingMode: "COMPANY" as const,
    };

    const dataset = buildRABTrackingDataset(project, []);

    expect(dataset.totals.opexBufferTotal).toBe(100_000);
    expect(dataset.totals.opexBufferInvestorShare).toBe(0);
    expect(dataset.totals.opexBufferCompanyShare).toBe(100_000);
    expect(dataset.totals.initialFundingNeed).toBe(1_000_000);
  });

  it("mendahulukan manual override recovery dan profit share", () => {
    const project = createBaseProject();
    const actuals: RABActualAchievement[] = [
      {
        id: "act-2",
        month: 2,
        actualSubscribers: 50,
        actualRevenue: 1_000_000,
        manualRecoveryInstallment: 300_000,
        manualInvestorProfitSharePercent: 60,
        manualInvestorShare: 200_000,
        manualCompanyShare: 100_000,
      },
    ];

    const dataset = buildRABTrackingDataset(project, actuals);
    const month2 = dataset.rows[1];

    expect(month2.actualRevenue).toBe(1_000_000);
    expect(month2.recoveryInstallment).toBe(300_000);
    expect(month2.hasManualRecoveryInstallment).toBe(true);

    expect(month2.investorProfitSharePercent).toBe(60);
    expect(month2.hasManualInvestorProfitSharePercent).toBe(true);

    expect(month2.investorShare).toBe(200_000);
    expect(month2.companyShare).toBe(100_000);
    expect(month2.hasManualInvestorShare).toBe(true);
    expect(month2.hasManualCompanyShare).toBe(true);

    expect(dataset.totals.investorShare).toBe(
      dataset.rows.reduce((sum, row) => sum + row.investorShare, 0),
    );
    expect(dataset.totals.companyShare).toBe(
      dataset.rows.reduce((sum, row) => sum + row.companyShare, 0),
    );
  });
});
