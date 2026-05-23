import { z } from "zod";

export const purchaseRequestListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(["DRAFT", "APPROVED", "REJECTED", "ORDERED", "RECEIVED"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const generatePOFromPRSchema = z.object({
  prIds: z.array(z.string().min(1)).min(1, "Minimal 1 PR harus dipilih"),
  overrideSupplierId: z.string().min(1).nullable().optional(),
});

export type PurchaseRequestListQuery = z.infer<
  typeof purchaseRequestListQuerySchema
>;
export type GeneratePOFromPRInput = z.infer<typeof generatePOFromPRSchema>;
