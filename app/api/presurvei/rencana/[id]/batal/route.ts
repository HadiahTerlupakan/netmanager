import { apiSuccess, createHandler } from "@/lib/api";
import {
  batalRencanaSchema,
  RencanaService,
  toRencanaDto,
} from "@/modules/presurvei";
import { muatKonteksRencana } from "../../konteks-rencana";

const service = new RencanaService();

/**
 * POST /api/presurvei/rencana/[id]/batal — batalkan rencana dengan alasan.
 *
 * Gerbangnya permission ubah, bukan hapus: rencana tidak pernah dihapus,
 * pembatalan tetap tercatat (siapa, kapan, alasan) untuk rekap.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_rencana:update", "m_presurvei:update"],
    schema: batalRencanaSchema,
  },
  async (_request, ctx) => {
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const rencana = await service.batalkan(
      ctx.params.id as string,
      ctx.validated.alasan,
      pengguna,
      lingkup,
    );
    const waktu = await service.konteksWaktu(pengguna.tenantId);
    return apiSuccess(toRencanaDto(rencana, waktu));
  },
);
