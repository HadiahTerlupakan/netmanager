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

/**
 * Lifecycle status supplier:
 * - ACTIVE: dapat dipilih saat create PO
 * - INACTIVE: dinonaktifkan sementara (mis. masa kontrak habis), tidak boleh dipakai PO baru
 * - BLACKLISTED: diblokir permanen karena masalah; dilarang untuk PO baru, butuh `blacklistReason`
 */
export type SupplierStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";

export const SUPPLIER_STATUSES: readonly SupplierStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "BLACKLISTED",
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
  status: SupplierStatus;
  blacklistReason: string | null;
  siupNumber: string | null;
  siupDocumentUrl: string | null;
  npwpDocumentUrl: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  contractDocumentUrl: string | null;
  contractExpiresAt: Date | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
