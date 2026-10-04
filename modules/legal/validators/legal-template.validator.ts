import { z } from "zod";
import { LEGAL_DOCUMENT_TYPES } from "../domain/entities/LegalDocument";
import { createLegalDocumentSchema, documentFieldsSchema } from "./legal.validator";

/** Validasi template dokumen legal dan pembuatan dokumen dari template. */

const MAX_BLOCKS = 200;
const MAX_BLOCK_TEXT = 5000;
const MAX_LIST_ITEMS = 50;
const MAX_LABEL = 200;

const blockText = z.string().max(MAX_BLOCK_TEXT);
const signatureSide = z.object({
  label: z.string().max(MAX_LABEL),
  name: z.string().max(MAX_LABEL),
});

export const templateBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().max(MAX_LABEL) }),
  z.object({ type: z.literal("paragraph"), text: blockText }),
  z.object({ type: z.literal("article"), title: z.string().max(MAX_LABEL), text: blockText }),
  z.object({ type: z.literal("list"), items: z.array(blockText).min(1).max(MAX_LIST_ITEMS) }),
  z.object({ type: z.literal("signatures"), left: signatureSide, right: signatureSide }),
]);

export const templateContentSchema = z.array(templateBlockSchema).min(1).max(MAX_BLOCKS);

export const createLegalTemplateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  documentType: z.enum(LEGAL_DOCUMENT_TYPES),
  categoryId: z.string().min(1).optional().nullable(),
  content: templateContentSchema,
});

/** Perubahan sebagian; jenis dokumen tetap mengikuti template saat dibuat. */
export const updateLegalTemplateSchema = createLegalTemplateSchema
  .omit({ documentType: true })
  .extend({ isActive: z.boolean() })
  .partial();

/**
 * Pratinjau PDF: isi blok dari editor + data dokumen yang sudah diketik.
 * Semua field longgar — pratinjau dipanggil saat formulir belum lengkap.
 */
export const previewLegalTemplateSchema = z.object({
  content: templateContentSchema,
  document: z
    .object({
      title: z.string().trim().max(MAX_LABEL).optional().nullable(),
      documentNumber: z.string().trim().max(MAX_LABEL).optional().nullable(),
      partyName: z.string().trim().max(MAX_LABEL).optional().nullable(),
      partyType: documentFieldsSchema.shape.partyType,
      partyId: z.string().min(1).optional().nullable(),
      startDate: z.coerce.date().optional().nullable(),
      endDate: z.coerce.date().optional().nullable(),
      value: documentFieldsSchema.shape.value,
    })
    .default({}),
});

/** Simpan dokumen legal baru yang PDF-nya disusun dari template. */
export const createDocumentFromTemplateSchema = z.object({
  content: templateContentSchema,
  document: createLegalDocumentSchema,
});

export type TemplateDocumentFields = z.infer<typeof previewLegalTemplateSchema>["document"];
export type CreateLegalTemplatePayload = z.infer<typeof createLegalTemplateSchema>;
export type UpdateLegalTemplatePayload = z.infer<typeof updateLegalTemplateSchema>;
