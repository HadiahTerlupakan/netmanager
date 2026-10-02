/**
 * Tipe masukan mesin tracking RAB. Struktural & longgar (angka boleh string
 * dari JSON API) agar bisa diisi dari UI admin maupun data Prisma di server.
 */

export interface LinearGrowthSettings {
  subscribersPerMonth: number;
}

export interface PercentageGrowthSettings {
  initialPercent: number;
  monthlyGrowthPercent: number;
}

export interface CustomMilestone {
  month: number;
  percent: number;
}

export interface CustomGrowthSettings {
  milestones: CustomMilestone[];
}

export type GrowthSettings =
  | LinearGrowthSettings
  | PercentageGrowthSettings
  | CustomGrowthSettings;

export type RABOpexBufferFundingMode =
  | "INVESTOR"
  | "COMPANY"
  | "SHARED_PERCENTAGE"
  | "FIXED";

export type RABInvestorProfitShareMode = "FLAT" | "TIERED_AFTER_BEP";

/** Capaian aktual satu bulan proyek (`month` = bulan ke-n sejak mulai). */
export interface RabTrackingAchievement {
  month: number;
  actualRevenue: number;
  manualRecoveryInstallment?: number | null;
  manualInvestorShare?: number | null;
  manualCompanyShare?: number | null;
  manualInvestorProfitSharePercent?: number | null;
}

/** Item RAB yang dibutuhkan tracking (hanya CAPEX yang dihitung modal). */
export interface RabTrackingItem {
  totalPrice: number | string;
  expenseType?: "CAPEX" | "OPEX";
}

/** Field proyek RAB yang dibaca mesin tracking. */
export interface RabTrackingProject {
  projectedOpex: number | string;
  targetSubscribers?: number | null;
  arpu?: number | string | null;
  growthType?: "LINEAR" | "PERCENTAGE" | "CUSTOM";
  paymentType?: "PREPAID" | "POSTPAID";
  growthSettings?: GrowthSettings | null;
  investmentDurationMonths?: number;
  investmentRecoveryType?: "PERCENTAGE" | "FIXED";
  investmentRecoveryValue?: number;
  investorProfitSharePercent?: number;
  investorProfitShareMode?: RABInvestorProfitShareMode;
  investorProfitShareBeforeBepPercent?: number;
  investorProfitShareAfterBepPercent?: number;
  nplTolerancePercent?: number;
  opexBufferFundingMode?: RABOpexBufferFundingMode;
  opexBufferInvestorPercent?: number;
  opexBufferInvestorFixedAmount?: string | number;
  opexBufferSafetyPercent?: number;
  items: RabTrackingItem[];
}
