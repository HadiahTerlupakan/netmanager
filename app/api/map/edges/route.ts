import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = getMappingService();

const createEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  name: z.string().optional(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const siteId = req.nextUrl.searchParams.get("siteId") || undefined;
    const edges = await service.getEdges(
      tenantCtx,
      siteId ? { siteId } : undefined,
    );
    return apiSuccess(edges);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["map:create"], schema: createEdgeSchema },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const body = ctx.validated;
    const newEdge = await service.createEdge(tenantCtx, body);

    await logger.logActivity({
      action: "CREATE",
      subject: "Edge",
      details: {
        edgeId: newEdge.edgeId,
        source: newEdge.source,
        target: newEdge.target,
      },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(newEdge, { status: 201 });
  },
);
