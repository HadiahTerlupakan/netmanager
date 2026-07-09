import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = getMappingService();

const updateEdgeSchema = z.object({
  name: z.string().optional(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { edgeId } = ctx.params;
    const edge = await service.getEdgeById(tenantCtx, edgeId);
    if (!edge) return ApiErrors.notFound("Edge");
    return apiSuccess(edge);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["map:update"], schema: updateEdgeSchema },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { edgeId } = ctx.params;
    const body = ctx.validated;
    const updatedEdge = await service.updateEdge(tenantCtx, edgeId, body);

    await logger.logActivity({
      action: "UPDATE",
      subject: "Edge",
      details: { id: edgeId, changes: body },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(updatedEdge, { message: "Edge updated successfully" });
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["map:delete"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { edgeId } = ctx.params;
    await service.deleteEdge(tenantCtx, edgeId);

    await logger.logActivity({
      action: "DELETE",
      subject: "Edge",
      details: { id: edgeId },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(
      { deleted: true },
      { message: "Edge deleted successfully" },
    );
  },
);
