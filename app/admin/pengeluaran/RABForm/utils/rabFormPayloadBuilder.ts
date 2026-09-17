import type { RabTargetBasis } from "@/modules/finance/client";
import type { GrowthSettings } from "../../rabTypes";
import type { LocalItem } from "../../ItemDisbursementModal";

export interface LocalWbs {
  id: string;
  name: string;
  order: number;
}

export interface PayloadBuilderParams {
  formData: {
    name: string;
    description: string;
    status: string;
    siteId: string;
    startDate: string;
    investmentDurationMonths: number;
    investmentRecoveryType: "PERCENTAGE" | "FIXED";
    investmentRecoveryValue: number;
    investorProfitSharePercent: number;
    investorProfitShareMode: string;
    investorProfitShareBeforeBepPercent: number;
    investorProfitShareAfterBepPercent: number;
    nplTolerancePercent: number;
    contingencyPercent: number;
    opexBufferFundingMode: string;
    opexBufferInvestorPercent: number;
    opexBufferCompanyPercent: number;
    opexBufferInvestorFixedAmount: number;
    opexBufferSafetyPercent: number;
    hasDisbursementPlan: boolean;
    investorIds: string[];
  };
  projectedRevenue: number;
  totalOpex: number;
  targetBasis: RabTargetBasis;
  targetHomepass: number;
  targetTakeUpRatePercent: number;
  effectiveTargetSubscribers: number;
  arpu: number;
  paymentType: "PREPAID" | "POSTPAID";
  growthType: string;
  currentGrowthSettings: GrowthSettings;
  contingencyAmount: number;
  wbsGroups: LocalWbs[];
  items: LocalItem[];
}

export function buildRABPayload(params: PayloadBuilderParams) {
  const {
    formData,
    projectedRevenue,
    totalOpex,
    targetBasis,
    targetHomepass,
    targetTakeUpRatePercent,
    effectiveTargetSubscribers,
    arpu,
    paymentType,
    growthType,
    currentGrowthSettings,
    contingencyAmount,
    wbsGroups,
    items,
  } = params;

  return {
    name: formData.name,
    description: formData.description,
    status: formData.status,
    siteId: formData.siteId || null,
    projectedRevenue: projectedRevenue,
    projectedOpex: totalOpex,
    targetBasis,
    targetHomepass: targetBasis === "HOMEPASS" ? targetHomepass : undefined,
    targetTakeUpRatePercent:
      targetBasis === "HOMEPASS" ? targetTakeUpRatePercent : 100,
    targetSubscribers: effectiveTargetSubscribers,
    arpu,
    paymentType,
    growthType,
    growthSettings: currentGrowthSettings,
    startDate: formData.startDate || undefined,
    investmentDurationMonths: formData.investmentDurationMonths,
    investmentRecoveryType: formData.investmentRecoveryType,
    investmentRecoveryValue: formData.investmentRecoveryValue,
    investorProfitSharePercent: formData.investorProfitSharePercent,
    investorProfitShareMode: formData.investorProfitShareMode,
    investorProfitShareBeforeBepPercent:
      formData.investorProfitShareBeforeBepPercent,
    investorProfitShareAfterBepPercent:
      formData.investorProfitShareAfterBepPercent,
    nplTolerancePercent: formData.nplTolerancePercent,
    contingencyPercent: formData.contingencyPercent,
    contingencyAmount,
    opexBufferFundingMode: formData.opexBufferFundingMode,
    opexBufferInvestorPercent: formData.opexBufferInvestorPercent,
    opexBufferCompanyPercent: formData.opexBufferCompanyPercent,
    opexBufferInvestorFixedAmount: formData.opexBufferInvestorFixedAmount,
    opexBufferSafetyPercent: formData.opexBufferSafetyPercent,
    hasDisbursementPlan: formData.hasDisbursementPlan,
    investorIds: formData.investorIds,
    wbsGroups: wbsGroups.map(({ id, name, order }) => ({
      id,
      name,
      order,
    })),
    items: items.map(({ id: _id, ...rest }) => ({
      ...rest,
      disbursements: rest.disbursements
        .map((d) => ({
          ...d,
          amount: (rest.unitPrice * rest.quantity * d.percentage) / 100,
        }))
        .map(({ id: _did, ...drest }) => drest),
    })),
  };
}
