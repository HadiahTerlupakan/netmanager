import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingAdminService, MappingService } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = new MappingService();
const adminService = getMappingAdminService();

// Schema Validation
const createNodeSchema = z.object({
  type: z.enum(["olt", "odc", "odp", "ont", "pole", "joinbox"]),
  name: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().default(0),
  splitter: z.string().nullish(),
  pppoe: z.string().nullish(),
  serialNumber: z.string().nullish(),
  notes: z.string().nullish(),
  attenuationIn: z.number().nullish(),
  attenuationOut: z.number().nullish(),
  inputCoreColor: z.string().nullish(),
  photo: z.string().nullish(),
  metadata: z.any().nullish(), // Allow metadata JSON
});

/**
 * @swagger
 * /api/map/nodes:
 *   get:
 *     summary: Get all map nodes
 *     tags: [Map]
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["map:read"],
  },
  async () => {
    const nodes = await service.getNodes();
    return apiSuccess(nodes);
  },
);

/**
 * @swagger
 * /api/map/nodes:
 *   post:
 *     summary: Create a new map node
 *     tags: [Map]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["map:create"],
    schema: createNodeSchema,
  },
  async (req, ctx) => {
    const body = ctx.validated;

    const newNode = await adminService.createNode({
      nodeId: crypto.randomUUID(),
      ...body,
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Node",
      details: { id: newNode.nodeId, name: newNode.name, type: newNode.type },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(newNode, { status: 201 });
  },
);
