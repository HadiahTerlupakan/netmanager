import { apiSuccess, createHandler } from "@/lib/api";
import { EndorsementService, toEndorsementDetail } from "@/modules/endorsement";

const service = new EndorsementService();

/** GET /api/admin/endorsements/[id] — detail surat beserta penanda tangannya. */
export const GET = createHandler(
  { auth: true, permissions: ["pengesahan:read"] },
  async (_request, ctx) => {
    const endorsement = await service.getById(ctx.params.id as string);

    return apiSuccess(toEndorsementDetail(endorsement));
  },
);
