import { z } from "zod";

import { KATEGORI_DOKUMEN } from "../domain/kategori-dokumen";

const MAKS_PANJANG_KETERANGAN = 500;

/*
 * Daftar kategorinya tinggal di domain, bukan di sini.
 *
 * Dulu daftar ini dipersempit ke kategori yang masuk akal untuk gambar, karena
 * unggahnya memang hanya menerima gambar: `TECHNICAL_DRAWING` dan
 * `APPROVAL_DOCUMENT` adalah berkas PDF, dan menjanjikannya di kontrak lalu
 * menolaknya di service adalah kebohongan yang lebih buruk daripada 400 yang
 * jujur. Sejak unggah PDF didukung, pembatasan itu tidak punya alasan lagi —
 * dan sejak daftarnya dibagi dengan form serta daftar dokumen, tidak ada lagi
 * salinan yang bisa menyimpang sendiri.
 */

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
