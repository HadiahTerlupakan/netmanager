import { buildRABTrackingDataset, type RabTrackingProject } from "../../utils/rab-tracking";
import type {
  RabExpenseType,
  RabGrowthType,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
} from "@prisma/client";

interface RabInvestmentProjectInput {
  projectedOpex: bigint;
  targetBasis?: RabTargetBasis | string;
  targetHomepass?: number | null;
  targetTakeUpRatePercent?: number | null;
  targetSubscribers?: number | null;
  arpu?: bigint | null;
  growthType: RabGrowthType | string;
  paymentType: RabPaymentType | string;
  growthSettings?: unknown;
  investmentDurationMonths: number;
  nplTolerancePercent: number;
  opexBufferFundingMode: RabOpexBufferFundingMode | string;
  opexBufferInvestorPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
}

interface RabInvestmentItemInput {
  quantity?: number;
  unitPrice?: bigint;
  expenseType?: RabExpenseType | string;
}

/** Menghitung total CAPEX dari daftar item investasi. */
export function getCapexTotal(items: RabInvestmentItemInput[]): number {
  return items
    .filter((item) => item.expenseType === "CAPEX")
    .reduce(
      (total, item) =>
        total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
}

/** Menghitung target pelanggan efektif berdasarkan basis target proyek. */
export function getEffectiveTargetSubscribers(
  project: RabInvestmentProjectInput,
): number {
  if (project.targetBasis !== "HOMEPASS") {
    return Number(project.targetSubscribers || 0);
  }

  return Math.round(
    Number(project.targetHomepass || 0) *
      (Number(project.targetTakeUpRatePercent || 0) / 100),
  );
}

/**
 * Modal yang didanai investor (CAPEX + bagian investor atas buffer OPEX).
 * Memakai mesin tracking RAB yang sama dengan halaman admin & bagi hasil,
 * sehingga modal tersimpan = modal yang dikembalikan oleh hitungan.
 */
export function getInvestorFundingBase(
  project: RabInvestmentProjectInput,
  items: RabInvestmentItemInput[],
): number {
  const { totals } = buildRABTrackingDataset(
    {
      projectedOpex: Number(project.projectedOpex),
      targetSubscribers: getEffectiveTargetSubscribers(project),
      arpu: project.arpu === null || project.arpu === undefined ? null : Number(project.arpu),
      growthType: project.growthType as RabTrackingProject["growthType"],
      paymentType: project.paymentType as RabTrackingProject["paymentType"],
      growthSettings: (project.growthSettings ?? null) as RabTrackingProject["growthSettings"],
      investmentDurationMonths: project.investmentDurationMonths,
      nplTolerancePercent: project.nplTolerancePercent,
      opexBufferFundingMode: project.opexBufferFundingMode as RabTrackingProject["opexBufferFundingMode"],
      opexBufferInvestorPercent: project.opexBufferInvestorPercent,
      opexBufferInvestorFixedAmount: Number(project.opexBufferInvestorFixedAmount),
      opexBufferSafetyPercent: project.opexBufferSafetyPercent,
      items: items.map((item) => ({
        totalPrice: Number(item.quantity || 0) * Number(item.unitPrice || 0),
        expenseType: (item.expenseType ?? "CAPEX") as "CAPEX" | "OPEX",
      })),
    },
    [],
  );
  return totals.initialFundingNeed;
}

/** Membagi basis investasi secara merata ke seluruh investor. */
export function splitInvestmentBase(
  investmentBase: number,
  investorIds: string[],
): number[] {
  const total = Math.round(investmentBase);
  const baseAmount = Math.floor(total / investorIds.length);
  const remainder = total % investorIds.length;

  return investorIds.map(
    (_, index) => baseAmount + (index < remainder ? 1 : 0),
  );
}
