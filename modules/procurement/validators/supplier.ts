import { z } from "zod";
import {
  SUPPLIER_PPH_CATEGORIES,
  SUPPLIER_STATUSES,
} from "../domain/entities/Supplier";

/** NPWP Indonesia: 15 digit numerik (format lama) atau 16 digit (NIK Coretax 2025). */
const NPWP_PATTERN = /^[0-9]{15,16}$/;

const npwpSchema = z
  .string()
  .trim()
  .regex(NPWP_PATTERN, "NPWP harus 15 atau 16 digit angka")
  .nullable()
  .optional();

const pphCategorySchema = z
  .enum(SUPPLIER_PPH_CATEGORIES as readonly [string, ...string[]])
  .nullable()
  .optional();

const statusSchema = z
  .enum(SUPPLIER_STATUSES as readonly [string, ...string[]])
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .url("URL tidak valid")
  .max(500)
  .nullable()
  .optional();

const optionalShortText = z.string().trim().max(200).nullable().optional();

const baseSupplierFields = {
  address: z.string().trim().max(500).nullable().optional(),
  contact: z.string().trim().max(100).nullable().optional(),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .nullable()
    .optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  npwp: npwpSchema,
  defaultPphCategory: pphCategorySchema,
  status: statusSchema,
  blacklistReason: z.string().trim().max(500).nullable().optional(),
  siupNumber: optionalShortText,
  siupDocumentUrl: optionalUrl,
  npwpDocumentUrl: optionalUrl,
  bankName: optionalShortText,
  bankAccountNumber: z.string().trim().max(50).nullable().optional(),
  bankAccountHolder: optionalShortText,
  contractDocumentUrl: optionalUrl,
  contractExpiresAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
} as const;

/**
 * Refinement: status BLACKLISTED wajib menyertakan alasan.
 * Tujuan: jejak audit kenapa supplier diblokir, syarat compliance.
 */
function requireBlacklistReason(
  data: { status?: string; blacklistReason?: string | null | undefined },
  ctx: z.RefinementCtx,
) {
  if (
    data.status === "BLACKLISTED" &&
    (!data.blacklistReason || data.blacklistReason.trim() === "")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blacklistReason"],
      message: "Alasan blacklist wajib diisi saat status BLACKLISTED",
    });
  }
}

export const createSupplierSchema = z
  .object({
    code: z.string().trim().min(1, "Kode supplier wajib diisi").max(50),
    name: z.string().trim().min(1, "Nama supplier wajib diisi").max(200),
    ...baseSupplierFields,
  })
  .superRefine(requireBlacklistReason);

export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    ...baseSupplierFields,
  })
  .superRefine(requireBlacklistReason);

export const supplierListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(SUPPLIER_STATUSES as readonly [string, ...string[]])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;
