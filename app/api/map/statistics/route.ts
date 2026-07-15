import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";

const service = getMappingService();

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const siteId = req.nextUrl.searchParams.get("siteId") || undefined;
    const stats = await service.getStatistics(
      tenantCtx,
      siteId ? { siteId } : undefined,
    );
    return apiSuccess(stats);
  },
);
