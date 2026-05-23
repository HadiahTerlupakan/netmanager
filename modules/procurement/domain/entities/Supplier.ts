/**
 * Klasifikasi PPh default supplier untuk PO/Expense.
 * Diselaraskan dengan tax module: jasa → PPh23, sewa → PPh23, sewa_tanah → PPh4(2).
 */
export type SupplierPphCategory = "jasa" | "sewa" | "sewa_tanah";

export const SUPPLIER_PPH_CATEGORIES: readonly SupplierPphCategory[] = [
  "jasa",
  "sewa",
  "sewa_tanah",
] as const;

export interface Supplier {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  defaultPphCategory: SupplierPphCategory | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
