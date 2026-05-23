import { z } from "zod";

const ppnRateSchema = z.coerce
  .number()
  .min(0, "PPN rate tidak valid")
  .max(100, "PPN rate maksimal 100")
  .default(0);

const purchaseOrderItemSchema = z.object({
  barangId: z.string().min(1, "Barang wajib dipilih"),
  quantity: z.coerce.number().int().positive("Jumlah harus lebih dari 0"),
  unitPrice: z.coerce.number().min(0, "Harga tidak boleh negatif"),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().nullable().optional(),
  expectedDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  ppnRate: ppnRateSchema.optional(),
  vendorNpwp: z
    .string()
    .trim()
    .regex(/^[0-9]{15,16}$/, "NPWP harus 15 atau 16 digit angka")
    .nullable()
    .optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "Minimal 1 item"),
});

export const updatePurchaseOrderSchema = z.object({
  expectedDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  fakturPajakNo: z.string().trim().max(50).nullable().optional(),
  fakturPajakDate: z.coerce.date().nullable().optional(),
  vendorNpwp: z
    .string()
    .trim()
    .regex(/^[0-9]{15,16}$/, "NPWP harus 15 atau 16 digit angka")
    .nullable()
    .optional(),
});

export const purchaseOrderListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;
export type UpdatePurchaseOrderInput = z.infer<
  typeof updatePurchaseOrderSchema
>;
export type PurchaseOrderListQuery = z.infer<
  typeof purchaseOrderListQuerySchema
>;
