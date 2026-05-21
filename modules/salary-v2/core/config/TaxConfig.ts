import type { TaxMethod } from "../domain/enums";

export interface ProgressiveRate {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export interface TerBracket {
  ptkpGroup: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

export interface PtkpAmount {
  status: string;
  annualAmount: number;
}

export interface TenantTaxConfig {
  defaultMethod: TaxMethod;
  terYear: number;
  npwpSurcharge: number;
  annualCorrectionMonth: number;
  biayaJabatanRate: number;
  biayaJabatanMax: number;
  biayaJabatanMaxAnnual: number;
  progressiveRates: ProgressiveRate[];
  terBrackets: TerBracket[];
  ptkpTable: PtkpAmount[];
}

export const DEFAULT_TAX_CONFIG: TenantTaxConfig = {
  defaultMethod: "NET",
  terYear: 2024,
  npwpSurcharge: 0.2,
  annualCorrectionMonth: 12,
  biayaJabatanRate: 0.05,
  biayaJabatanMax: 500000,
  biayaJabatanMaxAnnual: 6000000,
  progressiveRates: [
    { minAmount: 0, maxAmount: 60000000, rate: 0.05 },
    { minAmount: 60000000, maxAmount: 250000000, rate: 0.15 },
    { minAmount: 250000000, maxAmount: 500000000, rate: 0.25 },
    { minAmount: 500000000, maxAmount: 5000000000, rate: 0.3 },
    { minAmount: 5000000000, maxAmount: null, rate: 0.35 },
  ],
  terBrackets: [],
  ptkpTable: [
    { status: "TK_0", annualAmount: 54000000 },
    { status: "TK_1", annualAmount: 58500000 },
    { status: "TK_2", annualAmount: 63000000 },
    { status: "TK_3", annualAmount: 67500000 },
    { status: "K_0", annualAmount: 58500000 },
    { status: "K_1", annualAmount: 63000000 },
    { status: "K_2", annualAmount: 67500000 },
    { status: "K_3", annualAmount: 72000000 },
  ],
};
