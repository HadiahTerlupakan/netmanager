export type TaxType =
  | "PPN_KELUARAN"
  | "PPN_MASUKAN"
  | "PPH_21"
  | "PPH_23"
  | "PPH_4_2"
  | "BHP"
  | "USO"
  | "KSO";

export type TaxDirection = "IN" | "OUT";

export interface TaxConfig {
  id: string;
  tenantId: string;
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnRate: number;
  ppnIncluded: boolean;
  pph23RateJasa: number;
  pph23RateSewa: number;
  pph4Rate: number;
  bhpRate: number;
  usoRate: number;
  ksoRate: number;
  ppnDueDay: number;
  pph21DueDay: number;
  pph23DueDay: number;
  bhpDueMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Default config values for tenants that haven't configured tax yet */
export const DEFAULT_TAX_CONFIG: Omit<
  TaxConfig,
  "id" | "tenantId" | "createdAt" | "updatedAt"
> = {
  npwp: null,
  companyName: null,
  isPkp: false,
  ppnRate: 11,
  ppnIncluded: false,
  pph23RateJasa: 2,
  pph23RateSewa: 2,
  pph4Rate: 10,
  bhpRate: 0.5,
  usoRate: 1.25,
  ksoRate: 0,
  ppnDueDay: 15,
  pph21DueDay: 10,
  pph23DueDay: 10,
  bhpDueMonth: 4,
};
