import { apiSuccess, createHandler } from "@/lib/api";
import {
  jadikanCanvasingSchema,
  ProspekKonversiService,
  toProspekDetail,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../../../akses-presurvei";

const service = new ProspekKonversiService();

/** POST /api/presurvei/prospek/[id]/jadikan-canvasing — promosikan prospek. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: jadikanCanvasingSchema,
  },
  async (_request, ctx) => {
    const hasil = await service.jadikanCanvasing(
      ctx.params.id as string,
      ctx.validated,
      isBolehLihatSemuaPresurvei(ctx.permissions)
        ? undefined
        : ctx.session!.user.id,
    );

    return apiSuccess({
      prospek: toProspekDetail(hasil.prospek),
      canvasingId: hasil.canvasingId,
    });
  },
);
