
import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { z } from "zod";

const service = new MappingService();

const createEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  fiberType: z.string().optional(),
  distance: z.number().optional(),
  waypoints: z.string().optional(), // Expecting stringified JSON as per schema, or handle array in API and stringify here? Schema says String?, so stringified json.
  notes: z.string().optional(),
});

export const GET = withErrorHandler(async () => {
  const edges = await service.getEdges();
  return apiSuccess(edges);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  
  const validation = createEdgeSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Validation failed", validation.error.format());
  }

  const newEdge = await service.createEdge({
    ...validation.data
  });
  
  return apiSuccess(newEdge, { status: 201 });
});
