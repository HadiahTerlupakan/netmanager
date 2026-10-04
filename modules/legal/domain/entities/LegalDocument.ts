/**
 * Entitas domain modul legal.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const LEGAL_DOCUMENT_TYPES = [
  "KONTRAK",
  "IZIN",
  "SEWA_LAHAN",
  "KORPORAT",
] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_CONFIDENTIALITY_LEVELS = ["BIASA", "RAHASIA"] as const;
export type LegalConfidentiality = (typeof LEGAL_CONFIDENTIALITY_LEVELS)[number];

export const LEGAL_PAYMENT_SCHEMES = ["SEKALI", "BULANAN", "TAHUNAN"] as const;
export type LegalPaymentScheme = (typeof LEGAL_PAYMENT_SCHEMES)[number];

export const LEGAL_RECURRENCES = ["NONE", "MONTHLY", "YEARLY"] as const;
export type LegalRecurrence = (typeof LEGAL_RECURRENCES)[number];

export const LEGAL_PARTY_TYPES = [
  "MITRA",
  "PELANGGAN",
  "RESELLER",
  "VENDOR",
  "SITE",
] as const;
export type LegalPartyType = (typeof LEGAL_PARTY_TYPES)[number];

/** Status turunan dari tanggal — tidak pernah disimpan, jadi tidak bisa basi. */
export const LEGAL_DOCUMENT_STATUSES = [
  "AKTIF",
  "SEGERA_BERAKHIR",
  "KEDALUWARSA",
  "DIPERPANJANG",
  "DIAKHIRI",
] as const;
export type LegalDocumentStatus = (typeof LEGAL_DOCUMENT_STATUSES)[number];

export interface LegalCategoryEntity {
  id: string;
  name: string;
  documentType: LegalDocumentType;
  confidentiality: LegalConfidentiality;
  isBuiltIn: boolean;
  isActive: boolean;
  tenantId: string | null;
}

export interface LegalObligationEntity {
  id: string;
  description: string;
  dueDate: Date;
  recurrence: LegalRecurrence;
}

export interface LegalDocumentEntity {
  id: string;
  title: string;
  documentType: LegalDocumentType;
  category: Pick<LegalCategoryEntity, "id" | "name" | "confidentiality"> | null;
  documentNumber: string | null;
  partyName: string | null;
  partyType: LegalPartyType | null;
  partyId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  terminatedAt: Date | null;
  terminationReason: string | null;
  value: string | null;
  currency: string;
  paymentScheme: LegalPaymentScheme | null;
  guaranteeDescription: string | null;
  guaranteeEndDate: Date | null;
  isAutoRenew: boolean;
  noticePeriodDays: number | null;
  penaltyNotes: string | null;
  disputeResolution: string | null;
  notes: string | null;
  fileKey: string;
  fileName: string;
  fileHash: string;
  fileContentType: string;
  pic: { id: string; name: string | null } | null;
  endorsementId: string | null;
  previousDocumentId: string | null;
  renewedById: string | null;
  createdById: string;
  tenantId: string | null;
  createdAt: Date;
  obligations: LegalObligationEntity[];
}
