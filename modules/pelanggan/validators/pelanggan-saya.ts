import { z } from "zod";

const BATAS_HALAMAN_MAKS = 50;
const BATAS_HALAMAN_BAKU = 20;
const PANJANG_CARI_MAKS = 100;

/** Query `GET /api/mobile/pelanggan/saya`: cari, status, paginasi. */
export const pelangganSayaQuerySchema = z.object({
  cari: z.string().trim().max(PANJANG_CARI_MAKS).optional(),
  status: z.enum(["AKTIF", "ISOLIR", "NONAKTIF", "MAINTENANCE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(BATAS_HALAMAN_MAKS).default(BATAS_HALAMAN_BAKU),
});
