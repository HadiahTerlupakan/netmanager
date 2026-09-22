import { z } from "zod";
import { IKLAN_CHANNELS } from "../domain/entities/Iklan";

/**
 * Validasi masukan iklan presurvei.
 *
 * Kode kampanye dibatasi huruf kecil, angka, dan tanda hubung karena ia
 * dipasangkan dengan `utm_campaign` pada tautan iklan — spasi dan huruf besar
 * di sana akan tersandi berbeda-beda antar platform dan atribusinya meleset.
 */

const PANJANG_NAMA_MIN = 3;
const PANJANG_NAMA_MAKS = 120;
const PANJANG_KODE_MIN = 3;
const PANJANG_KODE_MAKS = 60;
const BIAYA_MAKS = 1_000_000_000_000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

const POLA_KODE = /^[a-z0-9-]+$/;

export const buatIklanSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS),
  kode: z
    .string()
    .min(PANJANG_KODE_MIN)
    .max(PANJANG_KODE_MAKS)
    .regex(POLA_KODE, "Kode hanya boleh huruf kecil, angka, dan tanda hubung"),
  channel: z.enum(IKLAN_CHANNELS),
  tanggalMulai: z.coerce.date(),
  tanggalSelesai: z.coerce.date().optional().nullable(),
  biaya: z.number().min(0).max(BIAYA_MAKS).optional().nullable(),
  penanggungJawabId: z.string().optional().nullable(),
  isAktif: z.boolean().optional(),
});

export const ubahIklanSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS).optional(),
  channel: z.enum(IKLAN_CHANNELS).optional(),
  tanggalMulai: z.coerce.date().optional(),
  tanggalSelesai: z.coerce.date().optional().nullable(),
  biaya: z.number().min(0).max(BIAYA_MAKS).optional().nullable(),
  penanggungJawabId: z.string().optional().nullable(),
  isAktif: z.boolean().optional(),
});

export const daftarIklanSchema = z.object({
  channel: z.enum(IKLAN_CHANNELS).optional(),
  isAktif: z
    .enum(["true", "false"])
    .transform((nilai) => nilai === "true")
    .optional(),
  search: z.string().max(PANJANG_NAMA_MAKS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATAS_HALAMAN_MAKS)
    .default(ISI_HALAMAN_BAWAAN),
});
