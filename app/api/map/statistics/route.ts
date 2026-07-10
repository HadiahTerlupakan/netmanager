import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";

const service = getMappingService();

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const stats = await service.getStatistics(tenantCtx);
    return apiSuccess(stats);
  },
);
