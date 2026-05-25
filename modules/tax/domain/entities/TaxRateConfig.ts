/**
 * Tax rate config entity — fleksibel per-tenant.
 *
 * Representasi 1 tarif pajak: code unik, kategori (PPN/PPH/BHP_USO/OTHER),
 * tarif persen, dan jatuh tempo. Tenant boleh tambah jenis pajak custom
 * (mis. PPh 26 vendor LN, retribusi daerah) dengan code custom.
 */
export type TaxRateCategoryValue = "PPN" | "PPH" | "BHP_USO" | "OTHER";

export interface TaxRateConfig {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: TaxRateCategoryValue;
  rate: number;
  dueDay: number | null;
  dueMonth: number | null;
  isActive: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaxRateConfigInput {
  code: string;
  name: string;
  category: TaxRateCategoryValue;
  rate: number;
  dueDay?: number | null;
  dueMonth?: number | null;
  isActive?: boolean;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateTaxRateConfigInput {
  name?: string;
  category?: TaxRateCategoryValue;
  rate?: number;
  dueDay?: number | null;
  dueMonth?: number | null;
  isActive?: boolean;
  description?: string | null;
  sortOrder?: number;
}
