import { TicketCategory, TicketPriority } from "@prisma/client";
import { z } from "zod";

// Id lama tidak selalu UUID (cuid/teks), jadi cukup dibatasi panjangnya.
const ID_MAKS = 64;
const SUBJEK_MAKS = 200;
const DESKRIPSI_MAKS = 5000;
const BALASAN_MAKS = 5000;
const BATAS_HALAMAN_MAKS = 50;
const BATAS_HALAMAN_BAKU = 20;

/** Body `POST /api/mobile/keluhan`: sales mencatat keluhan atas nama pelanggan. */
export const laporKeluhanSchema = z.object({
  pelangganId: z.string().min(1).max(ID_MAKS),
  kategori: z.enum(TicketCategory),
  prioritas: z.enum(TicketPriority).default("MEDIUM"),
  subjek: z.string().trim().min(3).max(SUBJEK_MAKS),
  deskripsi: z.string().trim().min(5).max(DESKRIPSI_MAKS),
});

/** Query `GET /api/mobile/keluhan`: kelompok status, saringan sales, paginasi. */
export const daftarKeluhanQuerySchema = z.object({
  status: z.enum(["TERBUKA", "SELESAI"]).default("TERBUKA"),
  salesId: z.string().min(1).max(ID_MAKS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(BATAS_HALAMAN_MAKS).default(BATAS_HALAMAN_BAKU),
});

/** Body `POST /api/mobile/keluhan/[id]/balasan`. */
export const balasKeluhanSchema = z.object({
  pesan: z.string().trim().min(1).max(BALASAN_MAKS),
});

export type LaporKeluhanInput = z.infer<typeof laporKeluhanSchema>;
export type DaftarKeluhanQuery = z.infer<typeof daftarKeluhanQuerySchema>;
