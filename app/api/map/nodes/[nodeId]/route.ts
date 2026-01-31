import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
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

type RouteContext = { params: Promise<{ nodeId: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, context: unknown) => {
  const { nodeId } = await (context as RouteContext).params;
  const node = await service.getNodeById(nodeId);

  if (!node) {
    return ApiErrors.notFound("Node");
  }

  return apiSuccess(node);
});

export const PUT = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const { nodeId } = await (context as RouteContext).params;
  const body = await req.json();

  const validation = updateNodeSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Validation failed", validation.error.format());
  }

  try {
    const updatedNode = await service.updateNode(nodeId, validation.data);
    return apiSuccess(updatedNode, { message: "Node updated successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "NODE_NOT_FOUND") {
      return ApiErrors.notFound("Node");
    }
    throw error;
  }
});

export const DELETE = withErrorHandler(async (_req: NextRequest, context: unknown) => {
  const { nodeId } = await (context as RouteContext).params;

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
