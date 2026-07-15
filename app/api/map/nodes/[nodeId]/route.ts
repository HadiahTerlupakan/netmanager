import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";
import * as z from "zod";
import { logger } from "@/lib/logger";

const service = getMappingService();

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
  siteId: z.string().nullish(),
});

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { nodeId } = ctx.params;
    const node = await service.getNodeById(tenantCtx, nodeId);
    if (!node) return ApiErrors.notFound("Node");
    return apiSuccess(node);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["map:update"], schema: updateNodeSchema },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { nodeId } = ctx.params;
    const body = ctx.validated;
    const updatedNode = await service.updateNode(tenantCtx, nodeId, body);

    await logger.logActivity({
      action: "UPDATE",
      subject: "Node",
      details: { id: nodeId, changes: body },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(updatedNode, { message: "Node updated successfully" });
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["map:delete"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const { nodeId } = ctx.params;
    await service.deleteNode(tenantCtx, nodeId);

    await logger.logActivity({
      action: "DELETE",
      subject: "Node",
      details: { id: nodeId },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(
      { deleted: true },
      { message: "Node deleted successfully" },
    );
  },
);
