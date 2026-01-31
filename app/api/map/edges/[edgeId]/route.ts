import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { verifyAuth } from "@/lib/auth";
import { z } from "zod";

const service = new MappingService();

const updateEdgeSchema = z.object({
  name: z.string().optional(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ edgeId: string }> };

export const GET = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const auth = await verifyAuth(req);
  if (!auth) return ApiErrors.unauthorized();
  
  const hasAccess = auth.permissions?.includes("map:read") || false;
  if (!hasAccess) return ApiErrors.forbidden();

  const { edgeId } = await (context as RouteContext).params;
  const edge = await service.getEdgeById(edgeId);

  if (!edge) {
    return ApiErrors.notFound("Edge");
  }

  return apiSuccess(edge);
});

export const PUT = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const auth = await verifyAuth(req);
  if (!auth) return ApiErrors.unauthorized();
  
  const hasAccess = auth.permissions?.includes("map:update") || false;
  if (!hasAccess) return ApiErrors.forbidden();

  const { edgeId } = await (context as RouteContext).params;
  const body = await req.json();

  const validation = updateEdgeSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Validation failed", validation.error.format());
  }

  try {
    const updatedEdge = await service.updateEdge(edgeId, validation.data);
    return apiSuccess(updatedEdge, { message: "Edge updated successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "EDGE_NOT_FOUND") {
      return ApiErrors.notFound("Edge");
    }
    throw error;
  }
});

export const DELETE = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const auth = await verifyAuth(req);
  if (!auth) return ApiErrors.unauthorized();
  
  const hasAccess = auth.permissions?.includes("map:delete") || false;
  if (!hasAccess) return ApiErrors.forbidden();

  const { edgeId } = await (context as RouteContext).params;

  try {
    await service.deleteEdge(edgeId);
    return apiSuccess({ deleted: true }, { message: "Edge deleted successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "EDGE_NOT_FOUND") {
      return ApiErrors.notFound("Edge");
    }
    throw error;
  }
});
