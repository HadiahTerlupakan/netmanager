
import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { z } from "zod";

const service = new MappingService();

const settingsSchema = z.object({
  centerLat: z.string().optional(),
  centerLng: z.string().optional(),
  maxZoomIn: z.string().optional(),
  maxZoomOut: z.string().optional(),
  defaultZoom: z.string().optional(),
});

export const GET = withErrorHandler(async () => {
  const settings = await service.getSettings();
  return apiSuccess(settings);
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  
  const validation = settingsSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Validation failed", validation.error.format());
  }

  // We rely on the repository handling create-or-update logic
  const updated = await service.updateSettings(validation.data);
  return apiSuccess(updated);
});
