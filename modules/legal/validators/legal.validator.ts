import { z } from "zod";
import { endorsementSignerInputSchema } from "@/modules/endorsement";
import {
  LEGAL_CONFIDENTIALITY_LEVELS,
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_PARTY_TYPES,
  LEGAL_PAYMENT_SCHEMES,
  LEGAL_RECURRENCES,
} from "../domain/entities/LegalDocument";

/**
 * Validasi masukan modul legal. Hanya judul dan jenis yang wajib — admin yang
 * merangkap legal cukup mengisi yang ia tahu; sisanya opsional.
 */

const MAX_TEXT = 2000;
const MAX_SHORT_TEXT = 200;
const MAX_NOTICE_DAYS = 3650;
const MAX_OBLIGATIONS = 50;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const optionalDate = z.coerce.date().optional().nullable();

export const legalObligationSchema = z.object({
  description: z.string().trim().min(3).max(MAX_SHORT_TEXT),
  dueDate: z.coerce.date(),
  recurrence: z.enum(LEGAL_RECURRENCES).default("NONE"),
});

const documentFieldsSchema = z.object({
  title: z.string().trim().min(3).max(MAX_SHORT_TEXT),
  documentType: z.enum(LEGAL_DOCUMENT_TYPES),
  categoryId: z.string().min(1).optional().nullable(),
  documentNumber: optionalText(MAX_SHORT_TEXT),
  partyName: optionalText(MAX_SHORT_TEXT),
  partyType: z.enum(LEGAL_PARTY_TYPES).optional().nullable(),
  partyId: z.string().min(1).optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate,
  value: z
    .string()
    .regex(/^\d{1,16}(\.\d{1,2})?$/, "Nilai harus angka, maksimal 2 desimal")
    .optional()
    .nullable(),
  currency: z.string().trim().length(3).default("IDR"),
  paymentScheme: z.enum(LEGAL_PAYMENT_SCHEMES).optional().nullable(),
  guaranteeDescription: optionalText(MAX_SHORT_TEXT),
  guaranteeEndDate: optionalDate,
  isAutoRenew: z.boolean().default(false),
  noticePeriodDays: z.number().int().min(1).max(MAX_NOTICE_DAYS).optional().nullable(),
  penaltyNotes: optionalText(MAX_TEXT),
  disputeResolution: optionalText(MAX_TEXT),
  notes: optionalText(MAX_TEXT),
  picUserId: z.string().min(1).optional().nullable(),
  obligations: z.array(legalObligationSchema).max(MAX_OBLIGATIONS).default([]),
});

/** Tanggal berakhir tidak boleh sebelum tanggal mulai. */
const datesInOrder = (fields: { startDate?: Date | null; endDate?: Date | null }) =>
  !fields.startDate || !fields.endDate || fields.endDate >= fields.startDate;

/** Isian field `payload` (JSON) pada form multipart pembuatan dokumen. */
export const createLegalDocumentSchema = documentFieldsSchema.refine(datesInOrder, {
  message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
  path: ["endDate"],
});

/** Perubahan sebagian; jenis dokumen tidak bisa diubah setelah dibuat. */
export const updateLegalDocumentSchema = documentFieldsSchema
  .omit({ documentType: true })
  .partial()
  .refine(datesInOrder, {
    message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  });

/** Perpanjangan: masa berlaku baru (wajib) dan perubahan opsional lainnya. */
export const renewLegalDocumentSchema = documentFieldsSchema
  .omit({ documentType: true })
  .partial()
  .extend({ endDate: z.coerce.date(), startDate: optionalDate })
  .refine(datesInOrder, {
    message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  });

export const terminateLegalDocumentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

/** Pencarian pihak kontrak dari modul lain untuk pemilih di formulir. */
export const partyOptionsQuerySchema = z.object({
  type: z.enum(LEGAL_PARTY_TYPES),
  search: z.string().trim().max(120).default(""),
});

export const listLegalDocumentsSchema = z.object({
  documentType: z.enum(LEGAL_DOCUMENT_TYPES).optional(),
  categoryId: z.string().min(1).optional(),
  status: z.enum(LEGAL_DOCUMENT_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createLegalCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  documentType: z.enum(LEGAL_DOCUMENT_TYPES),
  confidentiality: z.enum(LEGAL_CONFIDENTIALITY_LEVELS).default("BIASA"),
});

export const updateLegalCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    confidentiality: z.enum(LEGAL_CONFIDENTIALITY_LEVELS),
    isActive: z.boolean(),
  })
  .partial();

const MAX_SIGNERS = 20;

/** Kirim dokumen legal untuk ditandatangani lewat surat pengesahan. */
export const sendForSignatureSchema = z.object({
  title: z.string().trim().min(3).max(MAX_SHORT_TEXT).optional(),
  expiresAt: z.coerce.date().optional(),
  signers: z.array(endorsementSignerInputSchema).min(1).max(MAX_SIGNERS),
});

/** Arsipkan surat pengesahan yang sudah sah sebagai dokumen legal. */
export const archiveEndorsementSchema = documentFieldsSchema
  .extend({ endorsementId: z.string().min(1) })
  .refine(datesInOrder, {
    message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  });

export type CreateLegalDocumentPayload = z.infer<typeof createLegalDocumentSchema>;
export type UpdateLegalDocumentPayload = z.infer<typeof updateLegalDocumentSchema>;
export type RenewLegalDocumentPayload = z.infer<typeof renewLegalDocumentSchema>;
