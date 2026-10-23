import { z } from "zod";
import {
  ALAMAT_RENCANA_MAKS,
  ALASAN_BATAL_MAKS,
  ALASAN_BATAL_MIN,
  RENCANA_JENIS,
  RENCANA_STATUS_TAMPIL,
  TUJUAN_RENCANA_MAKS,
} from "../domain/entities/Rencana";
import { POLA_JAM, POLA_TANGGAL } from "../domain/rencana-rules";

/**
 * Validasi masukan rencana kunjungan presurvei.
 */

/** Agenda satu hari tim besar (mis. 30 sales × ~8 kunjungan) harus muat satu halaman. */
const LIMIT_MAKS = 300;
const LIMIT_BAWAAN = 20;
/** Rentang rekap dibatasi supaya satu permintaan tidak memuat data setahun. */
export const RENTANG_REKAP_HARI_MAKS = 92;
const MILIDETIK_PER_HARI = 86_400_000;

const tanggalSchema = z
  .string()
  .regex(POLA_TANGGAL, "Format tanggal harus YYYY-MM-DD")
  .refine((nilai) => !Number.isNaN(Date.parse(`${nilai}T00:00:00Z`)), {
    message: "Tanggal tidak valid",
  });

/** Jam opsional "HH:mm"; string kosong = tanpa jam. */
const jamSchema = z.preprocess(
  (nilai) => (nilai === "" ? null : nilai),
  z.string().regex(POLA_JAM, "Format jam harus HH:mm").nullable().optional(),
);

const tujuanSchema = z
  .string()
  .trim()
  .min(1, "Tujuan kunjungan wajib diisi")
  .max(TUJUAN_RENCANA_MAKS);

const alamatSchema = z.string().trim().max(ALAMAT_RENCANA_MAKS).optional().nullable();

export const buatRencanaSchema = z.object({
  salesId: z.string().min(1).optional(),
  tanggal: tanggalSchema,
  jam: jamSchema,
  jenis: z.enum(RENCANA_JENIS).default("KUNJUNGAN"),
  tujuan: tujuanSchema,
  prospekId: z.string().min(1).optional().nullable(),
  alamat: alamatSchema,
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const ubahRencanaSchema = z
  .object({
    tanggal: tanggalSchema.optional(),
    jam: jamSchema,
    jenis: z.enum(RENCANA_JENIS).optional(),
    tujuan: tujuanSchema.optional(),
    prospekId: z.string().min(1).optional().nullable(),
    alamat: alamatSchema,
  })
  .strict()
  .refine((isi) => Object.keys(isi).length > 0, {
    message: "Tidak ada perubahan",
  });

export const batalRencanaSchema = z.object({
  alasan: z.string().trim().min(ALASAN_BATAL_MIN).max(ALASAN_BATAL_MAKS),
});

export const daftarRencanaSchema = z
  .object({
    dari: tanggalSchema.optional(),
    sampai: tanggalSchema.optional(),
    salesId: z.string().min(1).optional(),
    status: z.enum(RENCANA_STATUS_TAMPIL).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(LIMIT_MAKS).default(LIMIT_BAWAAN),
  })
  .refine((f) => !f.dari || !f.sampai || f.dari <= f.sampai, {
    message: "Tanggal awal harus sebelum tanggal akhir",
  });

export const rekapRencanaSchema = z
  .object({ dari: tanggalSchema, sampai: tanggalSchema })
  .refine((r) => r.dari <= r.sampai, {
    message: "Tanggal awal harus sebelum tanggal akhir",
  })
  .refine(
    (r) =>
      (Date.parse(r.sampai) - Date.parse(r.dari)) / MILIDETIK_PER_HARI <
      RENTANG_REKAP_HARI_MAKS,
    { message: `Rentang rekap maksimal ${RENTANG_REKAP_HARI_MAKS} hari` },
  );

export type BuatRencanaMasukan = z.infer<typeof buatRencanaSchema>;
export type UbahRencanaMasukan = z.infer<typeof ubahRencanaSchema>;
