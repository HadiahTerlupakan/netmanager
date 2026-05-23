import { z } from "zod";

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

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : v));

const nonNegativeInt = z.number().int().nonnegative();
const optionalNonNegativeInt = nonNegativeInt.optional();

const reasonSchema = z
  .union([z.enum(OPNAME_REASON_CODES), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : v));

/** Schema satu item opname yang dikirim klien. */
export const opnameItemSchema = z
  .object({
    barangId: z.string().min(1, "barangId wajib diisi"),
    gudangId: z.string().min(1, "gudangId wajib diisi"),
    stokFisik: nonNegativeInt,
    keterangan: optionalString,
    kondisiBaik: optionalNonNegativeInt,
    kondisiRusak: optionalNonNegativeInt,
    kondisiExpire: optionalNonNegativeInt,
    lokasiPenyimpanan: optionalString,
    nomorRak: optionalString,
    nomorBox: optionalString,
    suhuPenyimpanan: optionalString,
    kelembaban: optionalString,
    tanggalExpire: optionalString,
    nomorBatch: optionalString,
    catatanDetail: optionalString,
    alasanSelisih: reasonSchema,
  })
  .superRefine((value, ctx) => {
    const total =
      (value.kondisiBaik ?? 0) +
      (value.kondisiRusak ?? 0) +
      (value.kondisiExpire ?? 0);

    if (total > value.stokFisik) {
      ctx.addIssue({
        code: "custom",
        path: ["stokFisik"],
        message:
          "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
      });
    }
  });

export type OpnameItemInput = z.infer<typeof opnameItemSchema>;

/**
 * Item dalam batch — `gudangId` opsional di tingkat item karena diwarisi
 * dari root batch. Sisa rule sama dengan {@link opnameItemSchema}.
 */
const opnameBatchItemSchema = z
  .object({
    barangId: z.string().min(1, "barangId wajib diisi"),
    stokFisik: nonNegativeInt,
    keterangan: optionalString,
    kondisiBaik: optionalNonNegativeInt,
    kondisiRusak: optionalNonNegativeInt,
    kondisiExpire: optionalNonNegativeInt,
    lokasiPenyimpanan: optionalString,
    nomorRak: optionalString,
    nomorBox: optionalString,
    suhuPenyimpanan: optionalString,
    kelembaban: optionalString,
    tanggalExpire: optionalString,
    nomorBatch: optionalString,
    catatanDetail: optionalString,
    alasanSelisih: reasonSchema,
  })
  .superRefine((value, ctx) => {
    const total =
      (value.kondisiBaik ?? 0) +
      (value.kondisiRusak ?? 0) +
      (value.kondisiExpire ?? 0);

    if (total > value.stokFisik) {
      ctx.addIssue({
        code: "custom",
        path: ["stokFisik"],
        message:
          "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
      });
    }
  });

export type OpnameBatchItemInput = z.infer<typeof opnameBatchItemSchema>;

/** Schema batch opname per gudang. */
export const opnameBatchSchema = z.object({
  gudangId: z.string().min(1, "gudangId wajib diisi"),
  items: z.array(opnameBatchItemSchema).min(1, "Minimal satu item opname"),
});

export type OpnameBatchInput = z.infer<typeof opnameBatchSchema>;

/** Schema update opname dari endpoint PUT /api/inventory/opname/[id]. */
export const opnameUpdateSchema = z
  .object({
    stokFisik: nonNegativeInt,
    keterangan: optionalString,
    kondisiBaik: optionalNonNegativeInt,
    kondisiRusak: optionalNonNegativeInt,
    kondisiExpire: optionalNonNegativeInt,
    lokasiPenyimpanan: optionalString,
    nomorRak: optionalString,
    nomorBox: optionalString,
    pic: optionalString,
    suhuPenyimpanan: optionalString,
    kelembaban: optionalString,
    tanggalExpire: optionalString,
    nomorBatch: optionalString,
    catatanDetail: optionalString,
    alasanSelisih: reasonSchema,
  })
  .superRefine((value, ctx) => {
    const total =
      (value.kondisiBaik ?? 0) +
      (value.kondisiRusak ?? 0) +
      (value.kondisiExpire ?? 0);

    if (total > value.stokFisik) {
      ctx.addIssue({
        code: "custom",
        path: ["stokFisik"],
        message:
          "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
      });
    }
  });

export type OpnameUpdateInput = z.infer<typeof opnameUpdateSchema>;
