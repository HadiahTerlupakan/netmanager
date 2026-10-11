import { z } from "zod";

const MAKS_PANJANG_KETERANGAN = 500;

/**
 * Seluruh kategori dokumen planning.
 *
 * Dulu daftar ini dipersempit ke kategori yang masuk akal untuk gambar, karena
 * unggahnya memang hanya menerima gambar: `TECHNICAL_DRAWING` dan
 * `APPROVAL_DOCUMENT` adalah berkas PDF, dan menjanjikannya di kontrak lalu
 * menolaknya di service adalah kebohongan yang lebih buruk daripada 400 yang
 * jujur. Sejak unggah PDF didukung, pembatasan itu tidak punya alasan lagi.
 *
 * Nilainya harus tetap sejalan dengan `DocumentCategory`
 * (`domain/entities/PlanningDocumentEntity.ts`) dan enum `DocumentCategory`
 * di Prisma.
 */
const KATEGORI_DOKUMEN = [
  "SURVEY_PHOTO",
  "COMPLETION_PHOTO",
  "NETWORK_DIAGRAM",
  "TECHNICAL_DRAWING",
  "APPROVAL_DOCUMENT",
  "OTHER",
] as const;

/** Kolom teks pada form unggah dokumen; berkasnya sendiri diperiksa service. */
export const unggahDokumenPlanningSchema = z.object({
  nodeId: z.string().min(1).nullish(),
  category: z
    .enum(KATEGORI_DOKUMEN, { message: "Kategori dokumen tidak dikenal" })
    .optional(),
  description: z.string().max(MAKS_PANJANG_KETERANGAN).nullish(),
});

export type UnggahDokumenPlanningFields = z.infer<
  typeof unggahDokumenPlanningSchema
>;
