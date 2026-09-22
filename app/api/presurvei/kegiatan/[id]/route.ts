import { apiSuccess, createHandler } from "@/lib/api";
import { KegiatanService, toKegiatanDetail } from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../../akses-presurvei";

const service = new KegiatanService();

/** GET /api/presurvei/kegiatan/[id] — rincian satu kegiatan. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const kegiatan = await service.detail(
      ctx.params.id as string,
      isBolehLihatSemuaPresurvei(ctx.permissions)
        ? undefined
        : ctx.session!.user.id,
    );
    return apiSuccess(toKegiatanDetail(kegiatan));
  },
);
