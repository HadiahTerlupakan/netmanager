import { z } from "zod";

/**
 * Query `GET /api/admin/presurvei/sales`.
 *
 * `prospekId` opsional dan, bila ada, wajib UUID: `PresurveiProspek.id`
 * memakai `@default(uuid())` (`prisma/schema.prisma`). String kosong
 * (`?prospekId=`) ditolak, bukan dianggap "tidak dikirim" — klien yang
 * mengirim parameter kosong sedang salah membentuk URL.
 */
export const daftarSalesPresurveiSchema = z.object({
  prospekId: z.string().uuid().optional(),
});
