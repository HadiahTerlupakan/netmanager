import { z } from "zod";

export const JASA_STATUS = ["ACTIVE", "INACTIVE"] as const;
export const JASA_SATUAN = [
  "job",
  "titik",
  "unit",
  "jam",
  "hari",
  "bulan",
] as const;
export const JASA_KATEGORI_PPH = ["jasa", "sewa", "sewa_tanah"] as const;

export const jasaCreateSchema = z.object({
  kode: z.string().trim().min(1).max(50).optional(),
  nama: z.string().trim().min(1, "Nama jasa wajib diisi").max(200),
  satuan: z.string().trim().min(1).max(30).default("job"),
  supplierId: z.string().trim().nullable().optional(),
  hargaEstimasi: z.coerce.number().min(0).default(0),
  kategoriPph: z.enum(JASA_KATEGORI_PPH).nullable().optional(),
  deskripsi: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(JASA_STATUS).default("ACTIVE"),
});

export const jasaUpdateSchema = jasaCreateSchema.partial();

export const restockJasaItemSchema = z.object({
  jasaId: z.string().trim().min(1, "jasaId wajib diisi"),
  jumlah: z.number().int().min(1, "Jumlah minimal 1").default(1),
  hargaPerUnit: z.number().min(0).default(0).optional(),
  keterangan: z.string().trim().nullable().optional(),
});

export const restockConfirmJasaSchema = z.object({
  items: z
    .array(
      z.object({
        jasaItemId: z.string().trim().min(1),
        tanggalSelesai: z.string().trim().nullable().optional(),
        buktiSelesai: z.array(z.string().url().or(z.string().min(1))).min(1),
      }),
    )
    .min(1, "Minimal 1 item jasa harus dikonfirmasi"),
});

export type JasaCreateInput = z.infer<typeof jasaCreateSchema>;
export type JasaUpdateInput = z.infer<typeof jasaUpdateSchema>;
export type RestockJasaItemInput = z.infer<typeof restockJasaItemSchema>;
export type RestockConfirmJasaInput = z.infer<typeof restockConfirmJasaSchema>;
