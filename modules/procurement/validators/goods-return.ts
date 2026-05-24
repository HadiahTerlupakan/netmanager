import { z } from "zod";
import {
  GOODS_RETURN_REASONS,
  GOODS_RETURN_STATUSES,
} from "../domain/entities/GoodsReturn";

export const goodsReturnItemSchema = z.object({
  goodsReceiptItemId: z.string().min(1),
  barangId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createGoodsReturnSchema = z.object({
  goodsReceiptId: z.string().min(1, "Goods Receipt wajib dipilih"),
  reason: z.enum(GOODS_RETURN_REASONS as readonly [string, ...string[]]),
  returnedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  fotoBukti: z.array(z.string().url()).max(20).optional(),
  items: z.array(goodsReturnItemSchema).min(1, "Minimal 1 item harus diretur"),
});

const RESOLVE_STATUSES = [
  "REFUNDED",
  "REPLACED",
  "CREDIT_NOTE",
  "CANCELLED",
] as const;

export const resolveGoodsReturnSchema = z.object({
  status: z.enum(RESOLVE_STATUSES),
  resolvedAt: z.string().datetime({ offset: true }).optional(),
  refundAmount: z.coerce.number().min(0).nullable().optional(),
  replacementGrnId: z.string().nullable().optional(),
  creditNoteRef: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const goodsReturnListQuerySchema = z.object({
  goodsReceiptId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z
    .enum(GOODS_RETURN_STATUSES as readonly [string, ...string[]])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateGoodsReturnInput = z.infer<typeof createGoodsReturnSchema>;
export type ResolveGoodsReturnInput = z.infer<typeof resolveGoodsReturnSchema>;
export type GoodsReturnListQuery = z.infer<typeof goodsReturnListQuerySchema>;
