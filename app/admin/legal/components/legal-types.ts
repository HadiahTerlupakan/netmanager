/**
 * Bentuk respons API modul legal yang dipakai halaman admin. Sengaja
 * didefinisikan ulang di sisi klien agar UI tidak mengimpor kode server.
 */

export const LEGAL_DOCUMENT_TYPES = [
  "KONTRAK",
  "IZIN",
  "SEWA_LAHAN",
  "KORPORAT",
] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_STATUSES = [
  "AKTIF",
  "SEGERA_BERAKHIR",
  "KEDALUWARSA",
  "DIPERPANJANG",
  "DIAKHIRI",
] as const;
export type LegalDocumentStatus = (typeof LEGAL_DOCUMENT_STATUSES)[number];

export const LEGAL_PAYMENT_SCHEMES = ["SEKALI", "BULANAN", "TAHUNAN"] as const;
export type LegalPaymentScheme = (typeof LEGAL_PAYMENT_SCHEMES)[number];

export const LEGAL_RECURRENCES = ["NONE", "MONTHLY", "YEARLY"] as const;
export type LegalRecurrence = (typeof LEGAL_RECURRENCES)[number];

export type LegalConfidentiality = "BIASA" | "RAHASIA";

export interface LegalDeadline {
  kind: string;
  label: string;
  date: string;
  daysLeft: number;
}

export interface LegalActionItem extends LegalDeadline {
  documentId: string;
  documentTitle: string;
  categoryName: string | null;
  picName: string | null;
}

export interface LegalDashboard {
  soonCount: number;
  expiredCount: number;
  dueThisWeekCount: number;
  actionItems: LegalActionItem[];
}

export interface LegalDocumentListItem {
  id: string;
  title: string;
  documentType: string;
  categoryId: string | null;
  categoryName: string | null;
  isConfidential: boolean;
  documentNumber: string | null;
  partyName: string | null;
  endDate: string | null;
  status: string;
  picName: string | null;
  nextDeadline: LegalDeadline | null;
}

export interface LegalObligation {
  id: string;
  description: string;
  dueDate: string;
  recurrence: string;
  nextDueDate: string;
}

export interface LegalDocumentDetail extends LegalDocumentListItem {
  startDate: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  value: string | null;
  currency: string;
  paymentScheme: string | null;
  guaranteeDescription: string | null;
  guaranteeEndDate: string | null;
  isAutoRenew: boolean;
  noticePeriodDays: number | null;
  penaltyNotes: string | null;
  disputeResolution: string | null;
  notes: string | null;
  fileName: string;
  picUserId: string | null;
  endorsementId: string | null;
  previousDocumentId: string | null;
  renewedById: string | null;
  createdAt: string;
  obligations: LegalObligation[];
  deadlines: LegalDeadline[];
}

export interface LegalCategory {
  id: string;
  name: string;
  documentType: string;
  confidentiality: LegalConfidentiality;
  isBuiltIn: boolean;
  isActive: boolean;
}

export interface LegalPicOption {
  userId: string;
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
}

/** Amplop respons sukses API (`{ success, data }`). */
export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: Record<string, string>;
}
