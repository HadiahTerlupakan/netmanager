import {
  RabExpenseType,
  RabItemCategory,
  RabOpexBufferFundingMode,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { RabProjectRepository } from "@/modules/finance/repositories/RabProjectRepository";
import { prismaMock } from "@/tests/setup";

describe("RabProjectRepository", () => {
  it("membagi komitmen investor dari CAPEX dan porsi buffer OPEX investor", async () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
    const repository = new RabProjectRepository(prismaMock as never);

    prismaMock.rabProject.create.mockResolvedValueOnce({
      id: "rab-1",
      investorProfitSharePercent: 50,
    });
    prismaMock.rabItem.create.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.rabProject.findUnique.mockResolvedValueOnce({ id: "rab-1" });

    await repository.createFullProject({
      project: {
        name: "RAB Buffer Investor",
        projectedRevenue: 1_000_000n,
        projectedOpex: 500_000n,
        targetSubscribers: 100,
        arpu: 10_000n,
        growthType: "LINEAR",
        paymentType: "PREPAID",
        growthSettings: { subscribersPerMonth: 50 },
        investmentDurationMonths: 2,
        investmentRecoveryType: "PERCENTAGE",
        investmentRecoveryValue: 50,
        investorProfitSharePercent: 50,
        contingencyPercent: 0,
        contingencyAmount: 0n,
        nplTolerancePercent: 20,
        opexBufferFundingMode: RabOpexBufferFundingMode.SHARED_PERCENTAGE,
        opexBufferInvestorPercent: 60,
        opexBufferCompanyPercent: 40,
        opexBufferInvestorFixedAmount: 0n,
        opexBufferSafetyPercent: 10,
        hasDisbursementPlan: false,
        createdBy: "user-1",
      },
      wbsGroups: [],
      investorIds: ["investor-1", "investor-2"],
      investorProfitSharePercent: 50,
      items: [
        {
          name: "Tower",
          quantity: 1,
          unitPrice: 1_000_000n,
          category: RabItemCategory.HARDWARE,
          expenseType: RabExpenseType.CAPEX,
          disbursements: [],
        },
      ],
    });

    expect(prismaMock.rabInvestor.createMany).toHaveBeenCalledWith({
      data: [
        {
          rabProjectId: "rab-1",
          investorId: "investor-1",
          investmentAmount: 533_000,
          profitSharePercent: 50,
        },
        {
          rabProjectId: "rab-1",
          investorId: "investor-2",
          investmentAmount: 533_000,
          profitSharePercent: 50,
        },
      ],
    });
  });

  it("menghitung buffer investor dari target efektif homepass", async () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
    const repository = new RabProjectRepository(prismaMock as never);

    prismaMock.rabProject.create.mockResolvedValueOnce({
      id: "rab-1",
      investorProfitSharePercent: 50,
    });
    prismaMock.rabItem.create.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.rabProject.findUnique.mockResolvedValueOnce({ id: "rab-1" });

    await repository.createFullProject({
      project: {
        name: "RAB Homepass Buffer",
        projectedRevenue: 1_000_000n,
        projectedOpex: 500_000n,
        targetBasis: "HOMEPASS",
        targetHomepass: 100,
        targetTakeUpRatePercent: 100,
        targetSubscribers: 0,
        arpu: 10_000n,
        growthType: "LINEAR",
        paymentType: "PREPAID",
        growthSettings: { subscribersPerMonth: 50 },
        investmentDurationMonths: 2,
        investmentRecoveryType: "PERCENTAGE",
        investmentRecoveryValue: 50,
        investorProfitSharePercent: 50,
        contingencyPercent: 0,
        contingencyAmount: 0n,
        nplTolerancePercent: 20,
        opexBufferFundingMode: RabOpexBufferFundingMode.SHARED_PERCENTAGE,
        opexBufferInvestorPercent: 60,
        opexBufferCompanyPercent: 40,
        opexBufferInvestorFixedAmount: 0n,
        opexBufferSafetyPercent: 10,
        hasDisbursementPlan: false,
        createdBy: "user-1",
      },
      wbsGroups: [],
      investorIds: ["investor-1", "investor-2"],
      investorProfitSharePercent: 50,
      items: [
        {
          name: "Tower",
          quantity: 1,
          unitPrice: 1_000_000n,
          category: RabItemCategory.HARDWARE,
          expenseType: RabExpenseType.CAPEX,
          disbursements: [],
        },
      ],
    });

    expect(prismaMock.rabInvestor.createMany).toHaveBeenCalledWith({
      data: [
        {
          rabProjectId: "rab-1",
          investorId: "investor-1",
          investmentAmount: 533_000,
          profitSharePercent: 50,
        },
        {
          rabProjectId: "rab-1",
          investorId: "investor-2",
          investmentAmount: 533_000,
          profitSharePercent: 50,
        },
      ],
    });
  });

  it("tidak membuang sisa pembulatan saat membagi komitmen investor", async () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
    const repository = new RabProjectRepository(prismaMock as never);

    prismaMock.rabProject.create.mockResolvedValueOnce({
      id: "rab-1",
      investorProfitSharePercent: 50,
    });
    prismaMock.rabItem.create.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.rabProject.findUnique.mockResolvedValueOnce({ id: "rab-1" });

    await repository.createFullProject({
      project: {
        name: "RAB Rounding",
        projectedRevenue: 0n,
        projectedOpex: 0n,
        targetSubscribers: 0,
        arpu: 0n,
        growthType: "LINEAR",
        paymentType: "PREPAID",
        growthSettings: { subscribersPerMonth: 1 },
        investmentDurationMonths: 1,
        investmentRecoveryType: "PERCENTAGE",
        investmentRecoveryValue: 50,
        investorProfitSharePercent: 50,
        contingencyPercent: 0,
        contingencyAmount: 0n,
        nplTolerancePercent: 0,
        opexBufferFundingMode: RabOpexBufferFundingMode.COMPANY,
        opexBufferInvestorPercent: 0,
        opexBufferCompanyPercent: 100,
        opexBufferInvestorFixedAmount: 0n,
        opexBufferSafetyPercent: 0,
        hasDisbursementPlan: false,
        createdBy: "user-1",
      },
      wbsGroups: [],
      investorIds: ["investor-1", "investor-2"],
      investorProfitSharePercent: 50,
      items: [
        {
          name: "Tower",
          quantity: 1,
          unitPrice: 1_000_001n,
          category: RabItemCategory.HARDWARE,
          expenseType: RabExpenseType.CAPEX,
          disbursements: [],
        },
      ],
    });

    expect(prismaMock.rabInvestor.createMany).toHaveBeenCalledWith({
      data: [
        {
          rabProjectId: "rab-1",
          investorId: "investor-1",
          investmentAmount: 500_001,
          profitSharePercent: 50,
        },
        {
          rabProjectId: "rab-1",
          investorId: "investor-2",
          investmentAmount: 500_000,
          profitSharePercent: 50,
        },
      ],
    });
  });

  it("menghitung ulang komitmen investor saat basis investasi berubah tanpa investorIds", async () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
    const repository = new RabProjectRepository(prismaMock as never);

    prismaMock.rabProject.update.mockResolvedValueOnce({ id: "rab-1" });
    prismaMock.rabInvestor.findMany.mockResolvedValueOnce([
      { investorId: "investor-1" },
      { investorId: "investor-2" },
    ]);
    prismaMock.rabProject.findUnique
      .mockResolvedValueOnce({
        id: "rab-1",
        projectedOpex: 500_000n,
        targetSubscribers: 100,
        arpu: 10_000n,
        growthType: "LINEAR",
        paymentType: "PREPAID",
        growthSettings: { subscribersPerMonth: 50 },
        investmentDurationMonths: 2,
        nplTolerancePercent: 20,
        opexBufferFundingMode: RabOpexBufferFundingMode.SHARED_PERCENTAGE,
        opexBufferInvestorPercent: 60,
        opexBufferInvestorFixedAmount: 0n,
        opexBufferSafetyPercent: 10,
        investorProfitSharePercent: 50,
        items: [
          {
            quantity: 1,
            unitPrice: 1_000_000n,
            expenseType: RabExpenseType.CAPEX,
          },
        ],
      })
      .mockResolvedValueOnce({ id: "rab-1", items: [], wbsGroups: [] });

    await repository.updateProjectWithRelations("rab-1", {
      opexBufferFundingMode: RabOpexBufferFundingMode.SHARED_PERCENTAGE,
      opexBufferInvestorPercent: 60,
      opexBufferCompanyPercent: 40,
    });

    expect(prismaMock.rabInvestor.updateMany).toHaveBeenCalledWith({
      where: { rabProjectId: "rab-1", investorId: "investor-1" },
      data: { investmentAmount: 533_000, profitSharePercent: 50 },
    });
    expect(prismaMock.rabInvestor.updateMany).toHaveBeenCalledWith({
      where: { rabProjectId: "rab-1", investorId: "investor-2" },
      data: { investmentAmount: 533_000, profitSharePercent: 50 },
    });
  });
});
