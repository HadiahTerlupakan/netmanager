import { z } from "zod";
import { BULAN_MAKS, BULAN_MIN } from "../domain/entities/Target";

/**
 * Validasi masukan target presurvei.
 */

const TAHUN_MIN = 2020;
const TAHUN_MAKS = 2100;
const TARGET_MAKS = 10_000;

export const tetapkanTargetSchema = z.object({
  userId: z.string().min(1),
  periodeTahun: z.number().int().min(TAHUN_MIN).max(TAHUN_MAKS),
  periodeBulan: z.number().int().min(BULAN_MIN).max(BULAN_MAKS),
  targetKunjungan: z.number().int().min(0).max(TARGET_MAKS),
  targetProspek: z.number().int().min(0).max(TARGET_MAKS),
  targetKonversi: z.number().int().min(0).max(TARGET_MAKS),
});

export const laporanPeriodeSchema = z.object({
  tahun: z.coerce.number().int().min(TAHUN_MIN).max(TAHUN_MAKS),
  bulan: z.coerce.number().int().min(BULAN_MIN).max(BULAN_MAKS),
});
