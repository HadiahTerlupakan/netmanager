import { z } from "zod";

const restockItemSchema = z.object({
  barangId: z.string().trim().min(1, "barangId wajib diisi"),
  jumlah: z.number().min(1, "Jumlah minimal 1").optional(),
  quantity: z.number().min(1, "Quantity minimal 1").optional(),
  keterangan: z.string().trim().nullable().optional(),
});

const restockJasaItemSchema = z.object({
  jasaId: z.string().trim().min(1, "jasaId wajib diisi"),
  jumlah: z.number().int().min(1, "Jumlah minimal 1").default(1),
  hargaPerUnit: z.number().min(0).default(0).optional(),
  keterangan: z.string().trim().nullable().optional(),
});

/** Schema untuk membuat purchase request restock (bisa barang, jasa, atau keduanya) */
export const restockCreateSchema = z
  .object({
    gudangId: z.string().trim().min(1, "Gudang wajib dipilih"),
    keterangan: z.string().trim().min(1, "Catatan / Keterangan wajib diisi"),
    items: z.array(restockItemSchema).default([]),
    jasaItems: z.array(restockJasaItemSchema).default([]),
  })
  .refine(
    (data) =>
      (data.items?.length ?? 0) > 0 || (data.jasaItems?.length ?? 0) > 0,
    { message: "Minimal 1 item barang atau jasa harus ditambahkan" },
  );

/** Schema untuk update purchase request restock (PUT) */
export const restockUpdateSchema = z
  .object({
    gudangId: z.string().trim().min(1, "Gudang wajib dipilih"),
    keterangan: z.string().trim().min(1, "Catatan / Keterangan wajib diisi"),
    items: z.array(restockItemSchema).default([]),
    jasaItems: z.array(restockJasaItemSchema).default([]),
  })
  .refine(
    (data) =>
      (data.items?.length ?? 0) > 0 || (data.jasaItems?.length ?? 0) > 0,
    { message: "Minimal 1 item barang atau jasa harus ditambahkan" },
  );

/** Schema untuk lifecycle action (PATCH) */
export const restockLifecycleSchema = z.object({
  action: z.string().trim().min(1, "Action wajib diisi"),
  catatan: z.string().trim().optional(),
});

export type RestockCreateInput = z.infer<typeof restockCreateSchema>;
export type RestockUpdateInput = z.infer<typeof restockUpdateSchema>;
export type RestockLifecycleInput = z.infer<typeof restockLifecycleSchema>;
