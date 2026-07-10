import { createHandler, apiSuccess } from "@/lib/api";
import { getMappingService } from "@/modules/map";
import { buildTenantContext } from "@/modules/map";
import * as z from "zod";

const service = getMappingService();

const DEFAULT_SETTINGS = {
  centerLat: "-6.2088",
  centerLng: "106.8456",
  maxZoomIn: "18",
  maxZoomOut: "5",
  defaultZoom: "13",
  updatedAt: null as string | null,
};

const settingsSchema = z.object({
  centerLat: z.string().optional(),
  centerLng: z.string().optional(),
  maxZoomIn: z.string().optional(),
  maxZoomOut: z.string().optional(),
  defaultZoom: z.string().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["map:read"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const settings = await service.getSettings(tenantCtx);
    return apiSuccess(settings ?? DEFAULT_SETTINGS);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["map:update"], schema: settingsSchema },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const updated = await service.updateSettings(tenantCtx, ctx.validated);
    return apiSuccess(updated);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["map:update"] },
  async (_req, ctx) => {
    const tenantCtx = buildTenantContext(ctx.session?.user);
    const updated = await service.updateSettings(tenantCtx, DEFAULT_SETTINGS);
    return apiSuccess({
      message: "Map settings reset to defaults",
      data: updated,
    });
  },
);
