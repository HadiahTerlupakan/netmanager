import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { MappingService } from "@/modules/map";
import { z } from "zod";
import { logger } from "@/lib/logger";

const service = new MappingService();

const updateEdgeSchema = z.object({
  name: z.string().optional(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/map/edges/{edgeId}:
 *   get:
 *     summary: Get edge by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: edgeId
 *         required: true
 *         schema:
 *           type: string
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async (_req, ctx) => {
  const { edgeId } = ctx.params;
  const edge = await service.getEdgeById(edgeId);

  if (!edge) {
    return ApiErrors.notFound("Edge");
  }

  return apiSuccess(edge);
});

/**
 * @swagger
 * /api/map/edges/{edgeId}:
 *   put:
 *     summary: Update edge by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: edgeId
 *         required: true
 *         schema:
 *           type: string
 */
export const PUT = createHandler({
  auth: true,
  permissions: ["map:update"],
  schema: updateEdgeSchema
}, async (_req, ctx) => {
  const { edgeId } = ctx.params;
  const body = ctx.validated;

  try {
    const updatedEdge = await service.updateEdge(edgeId, body);

    await logger.logActivity({
      action: "UPDATE",
      subject: "Edge",
      details: { id: edgeId, changes: body },
      userId: ctx.session?.user.id
    });

    return apiSuccess(updatedEdge, { message: "Edge updated successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "EDGE_NOT_FOUND") {
      return ApiErrors.notFound("Edge");
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/map/edges/{edgeId}:
 *   delete:
 *     summary: Delete edge by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: edgeId
 *         required: true
 *         schema:
 *           type: string
 */
export const DELETE = createHandler({
  auth: true,
  permissions: ["map:delete"]
}, async (_req, ctx) => {
  const { edgeId } = ctx.params;

  try {
    await service.deleteEdge(edgeId);

    await logger.logActivity({
      action: "DELETE",
      subject: "Edge",
      details: { id: edgeId },
      userId: ctx.session?.user.id
    });

    return apiSuccess({ deleted: true }, { message: "Edge deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "EDGE_NOT_FOUND") {
      return ApiErrors.notFound("Edge");
    }
    throw error;
  }
});
