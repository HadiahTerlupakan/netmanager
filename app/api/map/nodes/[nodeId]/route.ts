import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { MappingService } from "@/modules/map/services/MappingService";
import { z } from "zod";

const service = new MappingService();

const updateNodeSchema = z.object({
  name: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().optional(),
  splitter: z.string().optional(),
  pppoe: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/map/nodes/{nodeId}:
 *   get:
 *     summary: Get node by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async (req, ctx) => {
  const { nodeId } = ctx.params;
  const node = await service.getNodeById(nodeId);

  if (!node) {
    return ApiErrors.notFound("Node");
  }

  return apiSuccess(node);
});

/**
 * @swagger
 * /api/map/nodes/{nodeId}:
 *   put:
 *     summary: Update node by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 */
export const PUT = createHandler({
  auth: true,
  permissions: ["map:update"],
  schema: updateNodeSchema
}, async (req, ctx) => {
  const { nodeId } = ctx.params;
  const body = ctx.validated;

  try {
    const updatedNode = await service.updateNode(nodeId, body);
    return apiSuccess(updatedNode, { message: "Node updated successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "NODE_NOT_FOUND") {
      return ApiErrors.notFound("Node");
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/map/nodes/{nodeId}:
 *   delete:
 *     summary: Delete node by ID
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 */
export const DELETE = createHandler({
  auth: true,
  permissions: ["map:delete"]
}, async (req, ctx) => {
  const { nodeId } = ctx.params;

  try {
    await service.deleteNode(nodeId);
    return apiSuccess({ deleted: true }, { message: "Node deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "NODE_NOT_FOUND") {
      return ApiErrors.notFound("Node");
    }
    throw error;
  }
});
