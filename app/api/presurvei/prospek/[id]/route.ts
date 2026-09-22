import { apiSuccess, createHandler } from "@/lib/api";
import {
  ProspekService,
  toProspekDetail,
  ubahProspekSchema,
} from "@/modules/presurvei";

const service = new ProspekService();

/** GET /api/presurvei/prospek/[id] — rincian satu prospek. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const prospek = await service.detail(ctx.params.id as string);
    return apiSuccess(toProspekDetail(prospek));
  },
);

/** PATCH /api/presurvei/prospek/[id] — perbarui data atau status prospek. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: ubahProspekSchema,
  },
  async (_request, ctx) => {
    const prospek = await service.ubah(ctx.params.id as string, ctx.validated);
    return apiSuccess(toProspekDetail(prospek));
  },
);
