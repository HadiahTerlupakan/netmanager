import type { Prisma } from "@prisma/client";
import type {
  LegalCategoryEntity,
  LegalConfidentiality,
  LegalDocumentEntity,
  LegalDocumentType,
  LegalPartyType,
  LegalPaymentScheme,
  LegalRecurrence,
} from "../domain/entities/LegalDocument";

/**
 * Pemetaan baris Prisma ke entitas domain. Kolom jenis/status disimpan sebagai
 * teks supaya nilai baru tidak menuntut migrasi enum; pemetaan ini yang
 * mengembalikan ketatnya tipe.
 */

export const legalDocumentInclude = {
  category: { select: { id: true, name: true, confidentiality: true } },
  pic: { select: { id: true, name: true } },
  renewedBy: { select: { id: true } },
  obligations: { orderBy: { dueDate: "asc" } },
} satisfies Prisma.LegalDocumentInclude;

export type LegalDocumentRow = Prisma.LegalDocumentGetPayload<{
  include: typeof legalDocumentInclude;
}>;

type LegalCategoryRow = Prisma.LegalCategoryGetPayload<object>;

export function toLegalCategoryEntity(row: LegalCategoryRow): LegalCategoryEntity {
  return {
    id: row.id,
    name: row.name,
    documentType: row.documentType as LegalDocumentType,
    confidentiality: row.confidentiality as LegalConfidentiality,
    isBuiltIn: row.isBuiltIn,
    isActive: row.isActive,
    tenantId: row.tenantId,
  };
}

export function toLegalDocumentEntity(row: LegalDocumentRow): LegalDocumentEntity {
  return {
    id: row.id,
    title: row.title,
    documentType: row.documentType as LegalDocumentType,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          confidentiality: row.category.confidentiality as LegalConfidentiality,
        }
      : null,
    documentNumber: row.documentNumber,
    partyName: row.partyName,
    partyType: row.partyType as LegalPartyType | null,
    partyId: row.partyId,
    startDate: row.startDate,
    endDate: row.endDate,
    terminatedAt: row.terminatedAt,
    terminationReason: row.terminationReason,
    value: row.value?.toString() ?? null,
    currency: row.currency,
    paymentScheme: row.paymentScheme as LegalPaymentScheme | null,
    guaranteeDescription: row.guaranteeDescription,
    guaranteeEndDate: row.guaranteeEndDate,
    isAutoRenew: row.isAutoRenew,
    noticePeriodDays: row.noticePeriodDays,
    penaltyNotes: row.penaltyNotes,
    disputeResolution: row.disputeResolution,
    notes: row.notes,
    fileKey: row.fileKey,
    fileName: row.fileName,
    fileHash: row.fileHash,
    fileContentType: row.fileContentType,
    pic: row.pic ? { id: row.pic.id, name: row.pic.name } : null,
    endorsementId: row.endorsementId,
    previousDocumentId: row.previousDocumentId,
    renewedById: row.renewedBy?.id ?? null,
    createdById: row.createdById,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    obligations: row.obligations.map((obligation) => ({
      id: obligation.id,
      description: obligation.description,
      dueDate: obligation.dueDate,
      recurrence: obligation.recurrence as LegalRecurrence,
    })),
  };
}
