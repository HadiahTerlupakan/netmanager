import { createHandler, apiSuccess } from "@/lib/api";
import { MappingService } from "@/modules/map/services/MappingService";
import { z } from "zod";

const service = new MappingService();

// Schema Validation
const createNodeSchema = z.object({
  type: z.enum(['olt', 'odc', 'odp', 'ont']),
  name: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().default(0),
  splitter: z.string().optional(),
  pppoe: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/map/nodes:
 *   get:
 *     summary: Get all map nodes
 *     tags: [Map]
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async () => {
  const nodes = await service.getNodes();
  return apiSuccess(nodes);
});

/**
 * @swagger
 * /api/map/nodes:
 *   post:
 *     summary: Create a new map node
 *     tags: [Map]
 */
export const POST = createHandler({
  auth: true,
  permissions: ["map:create"],
  schema: createNodeSchema
}, async (req, ctx) => {
  const body = ctx.validated;

  const newNode = await service.createNode({
    nodeId: crypto.randomUUID(),
    ...body
  });
  
  return apiSuccess(newNode, { status: 201 });
});
