import { useMemo } from "react";
import {
  calculateEffectiveRabTargetSubscribers,
  calculateRabProjectedRevenue,
  calculateRabUnitCosts,
  type RabTargetBasis,
} from "@/modules/finance/client";
import type {
  RABProject,
  GrowthSettings,
  RABInvestorProfitShareMode,
  RABOpexBufferFundingMode,
} from "../../rabTypes";
import type { LocalItem } from "../../ItemDisbursementModal";

type GrowthType = NonNullable<RABProject["growthType"]>;

interface UseRABCalculationsParams {
  items: LocalItem[];
  formData: {
    name: string;
    contingencyPercent: number;
    nplTolerancePercent: number;
    investmentDurationMonths: number;
    investmentRecoveryType: "PERCENTAGE" | "FIXED";
    investmentRecoveryValue: number;
    investorProfitSharePercent: number;
    investorProfitShareMode: RABInvestorProfitShareMode;
    investorProfitShareBeforeBepPercent: number;
    investorProfitShareAfterBepPercent: number;
    opexBufferFundingMode: RABOpexBufferFundingMode;
    opexBufferInvestorPercent: number;
    opexBufferCompanyPercent: number;
    opexBufferInvestorFixedAmount: number;
    opexBufferSafetyPercent: number;
    status: string;
  };
  targetBasis: RabTargetBasis;
  targetHomepass: number;
  targetTakeUpRatePercent: number;
  targetSubscribers: number;
  arpu: number;
  paymentType: "PREPAID" | "POSTPAID";
  growthType: GrowthType;
  currentGrowthSettings: GrowthSettings;
}

export function useRABCalculations(params: UseRABCalculationsParams) {
  const {
    items,
    formData,
    targetBasis,
    targetHomepass,
    targetTakeUpRatePercent,
    targetSubscribers,
    arpu,
    paymentType,
    growthType,
    currentGrowthSettings,
  } = params;

  // Filter items by type
  const capexItems = items.filter((i) => i.expenseType === "CAPEX");
  const opexItems = items.filter((i) => i.expenseType === "OPEX");

  // Calculate totals
  const totalCapex = capexItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const totalOpex = opexItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  // Calculate Contingency
  const contingencyAmount = (totalCapex * formData.contingencyPercent) / 100;
  const totalInvestment = totalCapex + contingencyAmount;

  const effectiveTargetSubscribers = calculateEffectiveRabTargetSubscribers({
    targetBasis,
    targetSubscribers,
    targetHomepass,
    targetTakeUpRatePercent,
  });

  const unitCosts = calculateRabUnitCosts({
    totalCapex,
    targetHomepass,
    targetSubscribers: effectiveTargetSubscribers,
  });

  // Projected revenue at full capacity
  const projectedRevenue = calculateRabProjectedRevenue({
    targetBasis,
    targetSubscribers,
    targetHomepass,
    targetTakeUpRatePercent,
    arpu,
  });

  const realisticRevenue =
    projectedRevenue * (1 - formData.nplTolerancePercent / 100);

  // Profit Calculation (simple - at full capacity)
  const profitPerMonth = realisticRevenue - totalOpex;
  const simpleBepMonths =
    profitPerMonth > 0 ? totalCapex / profitPerMonth : Infinity;
  const margin =
    realisticRevenue > 0 ? (profitPerMonth / realisticRevenue) * 100 : 0;

  const previewProject = useMemo<RABProject>(
    () => ({
      id: "preview",
      name: formData.name || "Preview RAB",
      projectedRevenue,
      projectedOpex: totalOpex,
      targetBasis,
      targetHomepass,
      targetTakeUpRatePercent,
      targetSubscribers: effectiveTargetSubscribers,
      arpu,
      growthType,
      paymentType,
      growthSettings: currentGrowthSettings,
      investmentDurationMonths: formData.investmentDurationMonths,
      investmentRecoveryType: formData.investmentRecoveryType,
      investmentRecoveryValue: formData.investmentRecoveryValue,
      investorProfitSharePercent: formData.investorProfitSharePercent,
      investorProfitShareMode: formData.investorProfitShareMode,
      investorProfitShareBeforeBepPercent:
        formData.investorProfitShareBeforeBepPercent,
      investorProfitShareAfterBepPercent:
        formData.investorProfitShareAfterBepPercent,
      contingencyPercent: formData.contingencyPercent,
      nplTolerancePercent: formData.nplTolerancePercent,
      opexBufferFundingMode: formData.opexBufferFundingMode,
      opexBufferInvestorPercent: formData.opexBufferInvestorPercent,
      opexBufferCompanyPercent: formData.opexBufferCompanyPercent,
      opexBufferInvestorFixedAmount: formData.opexBufferInvestorFixedAmount,
      opexBufferSafetyPercent: formData.opexBufferSafetyPercent,
      status: formData.status,
      items: [
        {
          id: "preview-capex",
          name: "Preview CAPEX",
          quantity: 1,
          unitPrice: totalInvestment,
          totalPrice: totalInvestment,
          expenseType: "CAPEX",
        },
      ],
      createdAt: "",
      updatedAt: "",
    }),
    [
      arpu,
      currentGrowthSettings,
      effectiveTargetSubscribers,
      formData.contingencyPercent,
      formData.investmentDurationMonths,
      formData.investmentRecoveryType,
      formData.investmentRecoveryValue,
      formData.investorProfitShareAfterBepPercent,
      formData.investorProfitShareBeforeBepPercent,
      formData.investorProfitShareMode,
      formData.investorProfitSharePercent,
      formData.name,
      formData.nplTolerancePercent,
      formData.opexBufferCompanyPercent,
      formData.opexBufferFundingMode,
      formData.opexBufferInvestorFixedAmount,
      formData.opexBufferInvestorPercent,
      formData.opexBufferSafetyPercent,
      formData.status,
      growthType,
      paymentType,
      projectedRevenue,
      targetBasis,
      targetHomepass,
      targetTakeUpRatePercent,
      totalInvestment,
      totalOpex,
    ],
  );

  return {
    capexItems,
    opexItems,
    totalCapex,
    totalOpex,
    contingencyAmount,
    totalInvestment,
    effectiveTargetSubscribers,
    unitCosts,
    projectedRevenue,
    realisticRevenue,
    profitPerMonth,
    simpleBepMonths,
    margin,
    previewProject,
  };
}
