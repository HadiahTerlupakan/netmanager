import { z } from "zod";

const MAKS_PANJANG_KETERANGAN = 500;

/** Kategori yang masuk akal untuk gambar; kategori berkas dokumen belum didukung. */
const KATEGORI_GAMBAR = [
  "SURVEY_PHOTO",
  "COMPLETION_PHOTO",
  "NETWORK_DIAGRAM",
  "OTHER",
] as const;

/** Kolom teks pada form unggah dokumen; berkasnya sendiri diperiksa service. */
export const unggahDokumenPlanningSchema = z.object({
  nodeId: z.string().min(1).nullish(),
  category: z
    .enum(KATEGORI_GAMBAR, {
      message:
        "Kategori tidak didukung: saat ini hanya gambar yang bisa diunggah, unggah berkas dokumen (mis. PDF) belum didukung",
    })
    .optional(),
  description: z.string().max(MAKS_PANJANG_KETERANGAN).nullish(),
});

export type UnggahDokumenPlanningFields = z.infer<
  typeof unggahDokumenPlanningSchema
>;
