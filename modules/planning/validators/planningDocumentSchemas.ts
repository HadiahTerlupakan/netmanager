import { z } from "zod";

const MAKS_PANJANG_KETERANGAN = 500;

/** Kolom teks pada form unggah dokumen; berkasnya sendiri diperiksa service. */
export const unggahDokumenPlanningSchema = z.object({
  nodeId: z.string().min(1).nullish(),
  category: z
    .enum([
      "SURVEY_PHOTO",
      "NETWORK_DIAGRAM",
      "TECHNICAL_DRAWING",
      "APPROVAL_DOCUMENT",
      "COMPLETION_PHOTO",
      "OTHER",
    ])
    .optional(),
  description: z.string().max(MAKS_PANJANG_KETERANGAN).nullish(),
});

export type UnggahDokumenPlanningFields = z.infer<
  typeof unggahDokumenPlanningSchema
>;
