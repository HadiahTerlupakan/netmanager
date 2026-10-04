import type {
  LegalCategoryEntity,
  LegalDocumentEntity,
} from "../domain/entities/LegalDocument";
import {
  deriveStatus,
  isActionable,
  listDeadlines,
  nextObligationDate,
  type LegalDeadline,
} from "../domain/legal-rules";
import { partyDetailUrl } from "../domain/party-links";

/**
 * Bentuk data modul legal untuk klien. Kunci objek penyimpanan tidak pernah
 * ikut; berkas hanya diambil lewat rute server yang memeriksa izin.
 */

const toIso = (date: Date | null) => date?.toISOString() ?? null;

export interface LegalDeadlineDto {
  kind: string;
  label: string;
  date: string;
  daysLeft: number;
}

export interface LegalDocumentListItemDto {
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
  /** Tenggat terdekat yang perlu tindakan, bila ada. */
  nextDeadline: LegalDeadlineDto | null;
}

export interface LegalDocumentDetailDto extends LegalDocumentListItemDto {
  partyType: string | null;
  partyId: string | null;
  /** Halaman pihak di admin bila pihak tertaut ke data modul lain. */
  partyDetailUrl: string | null;
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
  fileHash: string;
  fileContentType: string;
  picUserId: string | null;
  endorsementId: string | null;
  previousDocumentId: string | null;
  renewedById: string | null;
  createdAt: string;
  obligations: Array<{
    id: string;
    description: string;
    dueDate: string;
    recurrence: string;
    nextDueDate: string;
  }>;
  deadlines: LegalDeadlineDto[];
}

export function toDeadlineDto(deadline: LegalDeadline): LegalDeadlineDto {
  return {
    kind: deadline.kind,
    label: deadline.label,
    date: deadline.date.toISOString(),
    daysLeft: deadline.daysLeft,
  };
}

/** Tenggat yang perlu tindakan, terdekat lebih dulu. */
export function actionableDeadlines(
  document: LegalDocumentEntity,
  now: Date,
): LegalDeadline[] {
  return listDeadlines(document, now)
    .filter(isActionable)
    .sort((left, right) => left.daysLeft - right.daysLeft);
}

export function toLegalDocumentListItem(
  document: LegalDocumentEntity,
  now: Date = new Date(),
): LegalDocumentListItemDto {
  const [nearest] = actionableDeadlines(document, now);

  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    categoryId: document.category?.id ?? null,
    categoryName: document.category?.name ?? null,
    isConfidential: document.category?.confidentiality === "RAHASIA",
    documentNumber: document.documentNumber,
    partyName: document.partyName,
    endDate: toIso(document.endDate),
    status: deriveStatus(document, now),
    picName: document.pic?.name ?? null,
    nextDeadline: nearest ? toDeadlineDto(nearest) : null,
  };
}

export function toLegalDocumentDetail(
  document: LegalDocumentEntity,
  now: Date = new Date(),
): LegalDocumentDetailDto {
  return {
    ...toLegalDocumentListItem(document, now),
    partyType: document.partyType,
    partyId: document.partyId,
    partyDetailUrl: partyDetailUrl(document.partyType, document.partyId),
    startDate: toIso(document.startDate),
    terminatedAt: toIso(document.terminatedAt),
    terminationReason: document.terminationReason,
    value: document.value,
    currency: document.currency,
    paymentScheme: document.paymentScheme,
    guaranteeDescription: document.guaranteeDescription,
    guaranteeEndDate: toIso(document.guaranteeEndDate),
    isAutoRenew: document.isAutoRenew,
    noticePeriodDays: document.noticePeriodDays,
    penaltyNotes: document.penaltyNotes,
    disputeResolution: document.disputeResolution,
    notes: document.notes,
    fileName: document.fileName,
    fileHash: document.fileHash,
    fileContentType: document.fileContentType,
    picUserId: document.pic?.id ?? null,
    endorsementId: document.endorsementId,
    previousDocumentId: document.previousDocumentId,
    renewedById: document.renewedById,
    createdAt: document.createdAt.toISOString(),
    obligations: document.obligations.map((obligation) => ({
      id: obligation.id,
      description: obligation.description,
      dueDate: obligation.dueDate.toISOString(),
      recurrence: obligation.recurrence,
      nextDueDate: nextObligationDate(obligation, now).toISOString(),
    })),
    deadlines: listDeadlines(document, now)
      .sort((left, right) => left.daysLeft - right.daysLeft)
      .map(toDeadlineDto),
  };
}

export interface LegalCategoryDto {
  id: string;
  name: string;
  documentType: string;
  confidentiality: string;
  isBuiltIn: boolean;
  isActive: boolean;
}

export function toLegalCategoryDto(category: LegalCategoryEntity): LegalCategoryDto {
  return {
    id: category.id,
    name: category.name,
    documentType: category.documentType,
    confidentiality: category.confidentiality,
    isBuiltIn: category.isBuiltIn,
    isActive: category.isActive,
  };
}
