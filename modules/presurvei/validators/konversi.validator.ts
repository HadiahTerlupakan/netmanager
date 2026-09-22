import { z } from "zod";

/**
 * Masukan pelengkap saat prospek dipromosikan menjadi canvasing.
 *
 * Canvasing menuntut nomor KTP, panjang kabel, dan paket dari daftar tetap —
 * tiga hal yang tidak dimiliki prospek. Endpoint promosi karenanya melengkapi,
 * bukan sekadar menyalin.
 */

const PANJANG_KTP_MIN = 16;
const PANJANG_KTP_MAKS = 20;
const KABEL_METER_MAKS = 5000;
const PANJANG_TEKS_MAKS = 120;

export const jadikanCanvasingSchema = z.object({
  noKtp: z.string().min(PANJANG_KTP_MIN).max(PANJANG_KTP_MAKS),
  paket: z.string().min(1).max(PANJANG_TEKS_MAKS),
  kabel: z.number().int().min(0).max(KABEL_METER_MAKS).optional(),
  odp: z.string().max(PANJANG_TEKS_MAKS).optional().nullable(),
  sn: z.string().max(PANJANG_TEKS_MAKS).optional().nullable(),
  foto: z.string().url().optional().nullable(),
  fotoKtp: z.string().url().optional().nullable(),
});

export type JadikanCanvasingInput = z.infer<typeof jadikanCanvasingSchema>;
