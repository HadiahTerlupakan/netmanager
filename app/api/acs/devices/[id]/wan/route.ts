import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService } from "@/modules/network";

export const dynamic = "force-dynamic";

const service = new AcsDeviceService();

export const POST = createHandler(
  { auth: true, permissions: ["acs:update"] },
  async (req, ctx) => {
    const deviceId = decodeURIComponent(ctx.params.id);
    if (!deviceId) return ApiErrors.badRequest("Device ID tidak ditemukan");

    try {
      const body = await req.json();
      const result = await service.configureWan({
        deviceId,
        username: body.username,
        password: body.password,
      });
      if (result.ok) return apiSuccess(result.data);
      return ApiErrors.internalError(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in WAN Manager:", message);
      return ApiErrors.internalError(`Konfigurasi WAN gagal: ${message}`);
    }
  },
);
