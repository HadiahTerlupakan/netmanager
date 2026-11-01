import { z } from "zod";

import {
  OPNAME_PESAN,
  pesanKondisiMelebihiStokFisik,
} from "../domain/opname-pesan";

/** Kode alasan selisih opname yang valid (mirror UI). */
export const OPNAME_REASON_CODES = [
  "hilang",
  "rusak",
  "revisi",
  "salah_input",
  "terpakai",
  "expired",
  "lebih",
  "lainnya",
] as const;

export type OpnameReasonCode = (typeof OPNAME_REASON_CODES)[number];

// Pesan di file ini dibaca petugas gudang di layar opname: sebut apa yang
// salah dan apa yang harus dilakukan, dengan kata sehari-hari.

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : v));

/** Jumlah barang: angka bulat, tidak minus, dengan pesan yang menyebut kolomnya. */
function jumlahBarang(label: string) {
  return z
    .number({ error: `${label} harus diisi angka.` })
    .int({ error: `${label} harus angka bulat, tanpa koma.` })
    .nonnegative({
      error: `${label} tidak boleh minus. Isi 0 kalau barangnya tidak ada.`,
    });
}

const reasonSchema = z
  .union([z.enum(OPNAME_REASON_CODES), z.literal("")], {
    error:
      "Alasan selisih tidak dikenal. Pilih alasan dari daftar yang tersedia.",
  })
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : v));

/** Field hasil hitung fisik yang sama di semua jalur opname. */
const opnameCountShape = {
  stokFisik: jumlahBarang("Stok fisik"),
  keterangan: optionalString,
  kondisiBaik: jumlahBarang("Jumlah kondisi Baik").optional(),
  kondisiRusak: jumlahBarang("Jumlah kondisi Rusak").optional(),
  kondisiExpire: jumlahBarang("Jumlah kondisi Expire").optional(),
  lokasiPenyimpanan: optionalString,
  nomorRak: optionalString,
  nomorBox: optionalString,
  suhuPenyimpanan: optionalString,
  kelembaban: optionalString,
  tanggalExpire: optionalString,
  nomorBatch: optionalString,
  catatanDetail: optionalString,
  alasanSelisih: reasonSchema,
};

const barangIdSchema = z
  .string({
    error: "Data barang tidak lengkap. Muat ulang halaman lalu coba lagi.",
  })
  .min(1, {
    error: "Data barang tidak lengkap. Muat ulang halaman lalu coba lagi.",
  });

const gudangIdSchema = z
  .string({ error: OPNAME_PESAN.gudangBelumDipilih })
  .min(1, { error: OPNAME_PESAN.gudangBelumDipilih });

/** Rincian kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik. */
function refineKondisiTidakMelebihiStokFisik(
  value: {
    stokFisik: number;
    kondisiBaik?: number;
    kondisiRusak?: number;
    kondisiExpire?: number;
  },
  ctx: z.RefinementCtx,
) {
  // Stok fisik yang bukan angka bulat atau minus sudah punya pesannya sendiri;
  // jangan ditambah pesan kedua yang membingungkan.
  if (!Number.isInteger(value.stokFisik) || value.stokFisik < 0) return;

  const total =
    (value.kondisiBaik ?? 0) +
    (value.kondisiRusak ?? 0) +
    (value.kondisiExpire ?? 0);
  if (total <= value.stokFisik) return;

  ctx.addIssue({
    code: "custom",
    path: ["stokFisik"],
    message: pesanKondisiMelebihiStokFisik(total, value.stokFisik),
  });
}

/** Schema satu item opname yang dikirim klien. */
export const opnameItemSchema = z
  .object({
    barangId: barangIdSchema,
    gudangId: gudangIdSchema,
    ...opnameCountShape,
  })
  .superRefine(refineKondisiTidakMelebihiStokFisik);

export type OpnameItemInput = z.infer<typeof opnameItemSchema>;

/**
 * Item dalam batch — `gudangId` tidak ada di tingkat item karena diwarisi
 * dari root batch. Sisa rule sama dengan {@link opnameItemSchema}.
 */
const opnameBatchItemSchema = z
  .object({ barangId: barangIdSchema, ...opnameCountShape })
  .superRefine(refineKondisiTidakMelebihiStokFisik);

export type OpnameBatchItemInput = z.infer<typeof opnameBatchItemSchema>;

/** Schema batch opname per gudang. */
export const opnameBatchSchema = z.object(
  {
    gudangId: gudangIdSchema,
    items: z
      .array(opnameBatchItemSchema, {
        error:
          "Daftar barang tidak terbaca. Muat ulang halaman lalu coba lagi.",
      })
      .min(1, {
        error:
          "Belum ada barang yang dicentang. Centang barang yang sudah dihitung, lalu simpan.",
      }),
  },
  { error: OPNAME_PESAN.dataTidakTerbaca },
);

export type OpnameBatchInput = z.infer<typeof opnameBatchSchema>;

/** Schema update opname dari endpoint PUT /api/inventory/opname/[id]. */
export const opnameUpdateSchema = z
  .object({ ...opnameCountShape, pic: optionalString })
  .superRefine(refineKondisiTidakMelebihiStokFisik);

export type OpnameUpdateInput = z.infer<typeof opnameUpdateSchema>;
