import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingAdminService, getMappingService } from "@/modules/map";
import { CANONICAL_NODE_TYPES } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = getMappingService();
const adminService = getMappingAdminService();

const createNodeSchema = z.object({
  type: z.enum(CANONICAL_NODE_TYPES),
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
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const nodes = await service.getNodes(tenantCtx);
    return apiSuccess(nodes);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["map:create"], schema: createNodeSchema },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const body = ctx.validated;
    const newNode = await adminService.createNode(tenantCtx, {
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
