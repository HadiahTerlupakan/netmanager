import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService, acsWanConfigSchema } from "@/modules/network";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { auth: true, permissions: ["acs:update"] },
  async (req, ctx) => {
    const deviceId = decodeURIComponent(ctx.params.id);
    if (!deviceId) return ApiErrors.badRequest("Device ID tidak ditemukan");

    try {
      const body = await req.json();
      const parsed = acsWanConfigSchema.safeParse(body);
      if (!parsed.success) {
        return ApiErrors.badRequest(
          parsed.error.issues[0]?.message || "Input tidak valid",
        );
      }

      const service = new AcsDeviceService();
      const result = await service.configureWan({
        deviceId,
        username: parsed.data.username,
        password: parsed.data.password,
      });
      if ("data" in result) return apiSuccess(result.data);
      return ApiErrors.internalError(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in WAN Manager:", message);
      return ApiErrors.internalError(`Konfigurasi WAN gagal: ${message}`);
    }
  },
);
