import { z } from "zod";

const restockItemSchema = z.object({
  barangId: z.string().trim().min(1, "barangId wajib diisi"),
  jumlah: z.number().min(1, "Jumlah minimal 1").optional(),
  quantity: z.number().min(1, "Quantity minimal 1").optional(),
  keterangan: z.string().trim().nullable().optional(),
});

/** Schema untuk membuat purchase request restock */
export const restockCreateSchema = z.object({
  gudangId: z.string().trim().min(1, "Gudang wajib dipilih"),
  keterangan: z.string().trim().optional(),
  items: z.array(restockItemSchema).min(1, "Minimal 1 item harus ditambahkan"),
});

/** Schema untuk update purchase request restock (PUT) */
export const restockUpdateSchema = z.object({
  gudangId: z.string().trim().min(1, "Gudang wajib dipilih"),
  keterangan: z.string().trim().optional(),
  items: z.array(restockItemSchema).min(1, "Minimal 1 item harus ditambahkan"),
});

/** Schema untuk lifecycle action (PATCH) */
export const restockLifecycleSchema = z.object({
  action: z.string().trim().min(1, "Action wajib diisi"),
  catatan: z.string().trim().optional(),
});

export type RestockCreateInput = z.infer<typeof restockCreateSchema>;
export type RestockUpdateInput = z.infer<typeof restockUpdateSchema>;
export type RestockLifecycleInput = z.infer<typeof restockLifecycleSchema>;
