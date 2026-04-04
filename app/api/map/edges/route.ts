import { createHandler, apiSuccess } from "@/lib/api";
import { MappingService } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = new MappingService();

const createEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  name: z.string().optional(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/map/edges:
 *   get:
 *     summary: Get all map edges
 *     tags: [Map]
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async () => {
  const edges = await service.getEdges();
  return apiSuccess(edges);
});

/**
 * @swagger
 * /api/map/edges:
 *   post:
 *     summary: Create a new map edge
 *     tags: [Map]
 */
export const POST = createHandler({
  auth: true,
  permissions: ["map:create"],
  schema: createEdgeSchema
}, async (req, ctx) => {
  const body = ctx.validated;

  const newEdge = await service.createEdge({
    ...body
  });
  
  await logger.logActivity({
    action: "CREATE",
    subject: "Edge",
    details: { edgeId: newEdge.edgeId, source: newEdge.source, target: newEdge.target },
    userId: ctx.session?.user.id
  });

  return apiSuccess(newEdge, { status: 201 });
});
