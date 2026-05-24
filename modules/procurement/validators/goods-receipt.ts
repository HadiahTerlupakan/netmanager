import { z } from "zod";

export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1, "Item PO tidak boleh kosong"),
  barangId: z.string().min(1, "Barang tidak boleh kosong"),
  quantity: z.coerce.number().int().min(1, "Quantity minimal 1"),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase Order tidak boleh kosong"),
  gudangId: z.string().min(1, "Gudang tujuan wajib dipilih"),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  fotoBukti: z.array(z.string().url()).max(20).optional(),
  items: z
    .array(goodsReceiptItemSchema)
    .min(1, "Minimal 1 item harus diterima"),
});

export const goodsReceiptListQuerySchema = z.object({
  purchaseOrderId: z.string().optional(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type GoodsReceiptListQuery = z.infer<typeof goodsReceiptListQuerySchema>;
