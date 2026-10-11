import type { DocumentCategory } from "./entities/PlanningDocumentEntity";

/**
 * Seluruh kategori dokumen planning — satu daftar tertutup, dipakai bersama
 * oleh validator unggah, form pemilihan kategori, dan daftar dokumen.
 *
 * Nilainya harus tetap sejalan dengan `DocumentCategory` dan enum
 * `DocumentCategory` di Prisma.
 */
export const KATEGORI_DOKUMEN = [
  "SURVEY_PHOTO",
  "COMPLETION_PHOTO",
  "NETWORK_DIAGRAM",
  "TECHNICAL_DRAWING",
  "APPROVAL_DOCUMENT",
  "OTHER",
] as const satisfies readonly DocumentCategory[];

/**
 * Label manusiawi tiap kategori.
 *
 * Ada supaya daftar dokumen tidak lagi memuntahkan nilai enum mentah
 * (`APPROVAL_DOCUMENT`) tepat di bawah form yang menamainya "Dokumen izin /
 * persetujuan". Satu berkas yang baru diunggah tampil dengan dua nama berbeda
 * di layar yang sama, dan yang terbaca pembaca justru nama basis datanya.
 */
export const LABEL_KATEGORI_DOKUMEN: Record<DocumentCategory, string> = {
  SURVEY_PHOTO: "Foto survei",
  COMPLETION_PHOTO: "Foto penyelesaian",
  NETWORK_DIAGRAM: "Diagram jaringan",
  TECHNICAL_DRAWING: "Gambar teknis",
  APPROVAL_DOCUMENT: "Dokumen izin / persetujuan",
  OTHER: "Lainnya",
};

/**
 * Kategori yang boleh dipilih untuk lampiran tingkat proyek.
 *
 * `SURVEY_PHOTO` tidak ada di sini: foto survei selalu menempel pada satu
 * titik dan diunggah dari popup titik di tab Peta, yang memaksa kategorinya
 * di server.
 */
export const KATEGORI_LAMPIRAN_PROYEK: readonly DocumentCategory[] = [
  "APPROVAL_DOCUMENT",
  "TECHNICAL_DRAWING",
  "NETWORK_DIAGRAM",
  "COMPLETION_PHOTO",
  "OTHER",
];

/** Label kategori, dengan nilai tak dikenal apa adanya agar tetap terbaca. */
export function labelKategoriDokumen(kategori: string): string {
  return LABEL_KATEGORI_DOKUMEN[kategori as DocumentCategory] ?? kategori;
}
