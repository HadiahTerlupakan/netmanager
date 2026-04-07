import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingAdminService } from "@/modules/map";
import * as z from "zod";

const service = getMappingAdminService();

const nodeSchema = z.object({
  nodeId: z.string(),
  type: z.enum(["server", "olt", "odc", "odp", "ont"]),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  capacity: z.number().optional(),
  splitter: z.string().nullable().optional(),
  pppoe: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const edgeSchema = z.object({
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  fiberType: z
    .enum([
      "feeder",
      "distribution",
      "drop",
      "odp_to_odp",
      "odp_to_odp_ratio",
      "odc_to_odc",
      "odc_to_odc_ratio",
    ])
    .optional(),
  distance: z.number().nullable().optional(),
  waypoints: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const syncSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

/**
 * @swagger
 * /api/map/sync:
 *   post:
 *     summary: Bulk sync all mapping data
 *     tags: [Map]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["map:update"],
    schema: syncSchema,
  },
  async (req, ctx) => {
    const { nodes, edges } = ctx.validated;

    await service.syncAllMappingData(nodes, edges);

    return apiSuccess({
      message: "Mapping data synchronized successfully",
      summary: {
        nodes: nodes.length,
        edges: edges.length,
      },
    });
  },
);
