import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { MappingService } from "@/modules/map";
import { z } from "zod";
import { logger } from "@/lib/logger";

const service = new MappingService();

const updateNodeSchema = z.object({
  name: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().optional(),
  splitter: z.string().nullish(),
  pppoe: z.string().nullish(),
  serialNumber: z.string().nullish(),
  notes: z.string().nullish(),
  attenuationIn: z.number().nullish(),
  attenuationOut: z.number().nullish(),
  inputCoreColor: z.string().nullish(),
  photo: z.string().nullish(),
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

    await logger.logActivity({
      action: "UPDATE",
      subject: "Node",
      details: { id: nodeId, changes: body },
      userId: ctx.session?.user.id
    });

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

    await logger.logActivity({
      action: "DELETE",
      subject: "Node",
      details: { id: nodeId },
      userId: ctx.session?.user.id
    });

    return apiSuccess({ deleted: true }, { message: "Node deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "NODE_NOT_FOUND") {
      return ApiErrors.notFound("Node");
    }
    throw error;
  }
});
