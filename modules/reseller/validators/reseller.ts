import * as z from "zod";

import { requiresStatusReason } from "../domain/reseller-compliance";
import {
  boundedOptionalTextSchema,
  normalizeBlankToUndefined,
  optionalDigitsSchema,
  optionalEmailSchema,
  optionalTextSchema,
  resellerStatusSchema,
} from "./shared";

/** Batas atas `limit` list reseller; form PPP memuat pilihan dengan limit=200. */
export const MAX_RESELLER_LIST_LIMIT = 200;
const DEFAULT_RESELLER_LIST_LIMIT = 20;
const MAX_SEARCH_LENGTH = 100;
const NIB_LENGTH = 13;
/**
 * KBLI selalu 5 digit, tetapi kodenya sengaja tidak dikunci: KBLI 2020 memakai
 * 61994 (jasa jual kembali jasa telekomunikasi) dan KBLI 2025 kemungkinan
 * memetakannya ke kode lain (61201). Cek kode yang aktif di OSS.
 */
const KBLI_LENGTH = 5;
const MAX_LEGAL_NAME_LENGTH = 200;
const MAX_CERTIFICATE_NUMBER_LENGTH = 100;
const MAX_BRAND_NAME_LENGTH = 100;
const MAX_STATUS_REASON_LENGTH = 500;

export const STATUS_REASON_REQUIRED_MESSAGE =
  "Alasan wajib diisi saat reseller ditangguhkan atau kemitraannya diakhiri";

const resellerFieldsSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: optionalEmailSchema,
  phone: optionalTextSchema,
  address: optionalTextSchema,
  notes: optionalTextSchema,
  status: resellerStatusSchema.optional(),
  statusReason: boundedOptionalTextSchema(MAX_STATUS_REASON_LENGTH),
  legalName: boundedOptionalTextSchema(MAX_LEGAL_NAME_LENGTH),
  nib: optionalDigitsSchema(NIB_LENGTH, "NIB harus 13 digit angka"),
  kbliCode: optionalDigitsSchema(KBLI_LENGTH, "Kode KBLI harus 5 digit angka"),
  standardCertificateNumber: boundedOptionalTextSchema(
    MAX_CERTIFICATE_NUMBER_LENGTH,
  ),
  brandName: boundedOptionalTextSchema(MAX_BRAND_NAME_LENGTH),
  /** true = tandai data izin sudah diverifikasi admin; false = cabut. */
  licenseVerified: z.boolean().optional(),
});

/**
 * Reseller baru yang langsung SUSPENDED/TERMINATED wajib disertai alasan.
 * Pada update, aturan yang sama ditegakkan service karena hanya service yang
 * tahu apakah status benar-benar berubah.
 */
export const createResellerSchema = resellerFieldsSchema.superRefine(
  (value, context) => {
    if (
      value.status &&
      requiresStatusReason(value.status) &&
      !value.statusReason
    ) {
      context.addIssue({
        code: "custom",
        message: STATUS_REASON_REQUIRED_MESSAGE,
        path: ["statusReason"],
      });
    }
  },
);

export const updateResellerSchema = resellerFieldsSchema.partial();

/**
 * Body pengaturan tata kelola reseller per tenant. Tiap sakelar opsional agar
 * satu sakelar bisa diubah tanpa menyentuh yang lain; minimal satu wajib ada.
 */
export const updateResellerComplianceSettingSchema = z
  .object({
    isComplianceRequired: z.boolean().optional(),
    isSettlementSeparateApproverRequired: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.isComplianceRequired !== undefined ||
      value.isSettlementSeparateApproverRequired !== undefined,
    { message: "Minimal satu pengaturan wajib diisi" },
  );

/** Query list reseller: page/limit wajib angka positif, limit dibatasi. */
export const listResellersQuerySchema = z.object({
  page: z.preprocess(
    normalizeBlankToUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    normalizeBlankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_RESELLER_LIST_LIMIT)
      .default(DEFAULT_RESELLER_LIST_LIMIT),
  ),
  search: z.preprocess(
    normalizeBlankToUndefined,
    z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
  ),
  status: z.preprocess(
    normalizeBlankToUndefined,
    resellerStatusSchema.optional(),
  ),
});

export type CreateResellerSchema = z.infer<typeof createResellerSchema>;
export type UpdateResellerSchema = z.infer<typeof updateResellerSchema>;
export type UpdateResellerComplianceSettingSchema = z.infer<
  typeof updateResellerComplianceSettingSchema
>;
export type ListResellersQuerySchema = z.infer<typeof listResellersQuerySchema>;
