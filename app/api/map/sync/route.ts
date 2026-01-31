import { createHandler, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
  fiberType: z.enum([
    "feeder",
    "distribution",
    "drop",
    "odp_to_odp",
    "odp_to_odp_ratio",
    "odc_to_odc",
    "odc_to_odc_ratio"
  ]).optional(),
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
export const POST = createHandler({
  auth: true,
  permissions: ["map:update"],
  schema: syncSchema
}, async (req, ctx) => {
  const { nodes, edges } = ctx.validated;

  // Use transaction to ensure atomic operation
  await prisma.$transaction(async (tx) => {
    // Delete all existing edges first (foreign key constraint)
    await tx.mappingEdge.deleteMany({});

    // Delete all existing nodes
    await tx.mappingNode.deleteMany({});

    // Insert new nodes
    if (nodes.length > 0) {
      await tx.mappingNode.createMany({
        data: nodes.map((node) => ({
          nodeId: node.nodeId,
          type: node.type === "server" ? "olt" : node.type,
          name: node.name,
          latitude: node.latitude,
          longitude: node.longitude,
          capacity: node.capacity || 8,
          splitter: node.splitter || null,
          pppoe: node.pppoe || null,
          serialNumber: node.serialNumber || null,
          notes: node.notes || null,
        })),
      });
    }

    // Insert new edges
    if (edges.length > 0) {
      await tx.mappingEdge.createMany({
        data: edges.map((edge) => ({
          edgeId: edge.edgeId,
          source: edge.source,
          target: edge.target,
          fiberType: edge.fiberType || "distribution",
          distance: edge.distance || null,
          waypoints: edge.waypoints || null,
          notes: edge.notes || null,
        })),
      });
    }
  });

  return apiSuccess({
    message: "Mapping data synchronized successfully",
    summary: {
      nodes: nodes.length,
      edges: edges.length,
    },
  });
});
