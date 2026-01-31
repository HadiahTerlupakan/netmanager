
import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { z } from "zod";

const service = new MappingService();

// Default settings matching GenieACS
const DEFAULT_SETTINGS = {
  centerLat: "-6.2088",
  centerLng: "106.8456",
  maxZoomIn: "18",
  maxZoomOut: "5",
  defaultZoom: "13",
};

const settingsSchema = z.object({
  centerLat: z.string().optional(),
  centerLng: z.string().optional(),
  maxZoomIn: z.string().optional(),
  maxZoomOut: z.string().optional(),
  defaultZoom: z.string().optional(),
});

export const GET = withErrorHandler(async () => {
  const settings = await service.getSettings();
  // Return defaults if no settings exist
  if (!settings) {
    return apiSuccess(DEFAULT_SETTINGS);
  }
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

/**
 * POST /api/map/settings - Reset to default settings
 */
export const POST = withErrorHandler(async () => {
  const updated = await service.updateSettings(DEFAULT_SETTINGS);
  return apiSuccess({
    message: "Map settings reset to defaults",
    data: updated,
  });
});
