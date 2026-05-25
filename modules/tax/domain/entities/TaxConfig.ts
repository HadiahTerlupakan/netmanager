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

/**
 * TaxConfig sekarang hanya simpan **identitas perusahaan** untuk lapor pajak.
 * Tarif dan jatuh tempo per jenis pajak pindah ke `TaxRateConfig` — single
 * source of truth yang fleksibel per-tenant.
 */
export interface TaxConfig {
  id: string;
  tenantId: string;
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnIncluded: boolean;
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
  ppnIncluded: false,
};
