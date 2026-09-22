import { apiSuccess, createHandler } from "@/lib/api";
import {
  IklanService,
  toIklanDetail,
  ubahIklanSchema,
} from "@/modules/presurvei";

const service = new IklanService();

/** GET /api/admin/presurvei/iklan/[id] — rincian satu iklan. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_iklan:read"] },
  async (_request, ctx) => {
    const iklan = await service.detail(ctx.params.id as string);
    return apiSuccess(toIklanDetail(iklan));
  },
);

/** PATCH /api/admin/presurvei/iklan/[id] — perbarui kampanye iklan. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei_iklan:update"],
    schema: ubahIklanSchema,
  },
  async (_request, ctx) => {
    const iklan = await service.ubah(ctx.params.id as string, ctx.validated);
    return apiSuccess(toIklanDetail(iklan));
  },
);
