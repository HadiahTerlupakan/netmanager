import * as z from "zod";

import {
  normalizeBlankToUndefined,
  optionalEmailSchema,
  optionalTextSchema,
  resellerStatusSchema,
} from "./shared";

/** Batas atas `limit` list reseller; form PPP memuat pilihan dengan limit=200. */
export const MAX_RESELLER_LIST_LIMIT = 200;
const DEFAULT_RESELLER_LIST_LIMIT = 20;
const MAX_SEARCH_LENGTH = 100;

export const createResellerSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: optionalEmailSchema,
  phone: optionalTextSchema,
  address: optionalTextSchema,
  notes: optionalTextSchema,
  status: resellerStatusSchema.optional(),
});

export const updateResellerSchema = createResellerSchema.partial();

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
export type ListResellersQuerySchema = z.infer<typeof listResellersQuerySchema>;
