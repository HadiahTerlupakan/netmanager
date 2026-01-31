import { createHandler, apiSuccess } from "@/lib/api";
import { MappingService } from "@/modules/map/services/MappingService";
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

/**
 * @swagger
 * /api/map/settings:
 *   get:
 *     summary: Get map settings
 *     tags: [Map]
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async () => {
  const settings = await service.getSettings();
  if (!settings) {
    return apiSuccess(DEFAULT_SETTINGS);
  }
  return apiSuccess(settings);
});

/**
 * @swagger
 * /api/map/settings:
 *   put:
 *     summary: Update map settings
 *     tags: [Map]
 */
export const PUT = createHandler({
  auth: true,
  permissions: ["map:update"],
  schema: settingsSchema
}, async (req, ctx) => {
  const body = ctx.validated;
  const updated = await service.updateSettings(body);
  return apiSuccess(updated);
});

/**
 * @swagger
 * /api/map/settings:
 *   post:
 *     summary: Reset to default settings
 *     tags: [Map]
 */
export const POST = createHandler({
  auth: true,
  permissions: ["map:update"]
}, async () => {
  const updated = await service.updateSettings(DEFAULT_SETTINGS);
  return apiSuccess({
    message: "Map settings reset to defaults",
    data: updated,
  });
});
