import { apiSuccess, createHandler } from "@/lib/api";
import { rekapRencanaSchema, RencanaService } from "@/modules/presurvei";
import { muatKonteksRencana } from "../konteks-rencana";

const service = new RencanaService();

/**
 * GET /api/presurvei/rencana/rekap?dari&sampai — rencana vs realisasi per
 * sales dalam lingkup pemanggil (admin semua, kepala sales timnya). Dipakai
 * layar admin dan aplikasi kepala sales; sales biasa (lingkup SENDIRI) hanya
 * menerima barisnya sendiri.
 */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_rencana:read", "m_presurvei:read"] },
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const rentang = rekapRencanaSchema.parse({
      dari: searchParams.get("dari") ?? undefined,
      sampai: searchParams.get("sampai") ?? undefined,
    });
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const rekap = await service.rekap(rentang, lingkup, pengguna.tenantId);
    return apiSuccess({ hariIni: rekap.waktu.hariIni, baris: rekap.baris });
  },
);
