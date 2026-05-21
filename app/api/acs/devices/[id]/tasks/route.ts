import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService, acsTaskSchema } from "@/modules/network";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { auth: true, permissions: ["acs:update"] },
  async (req, ctx) => {
    const deviceId = decodeURIComponent(ctx.params.id);
    if (!deviceId) return ApiErrors.badRequest("Device ID tidak ditemukan");

    try {
      const body = await req.json();
      const parsed = acsTaskSchema.safeParse(body);
      if (!parsed.success) {
        return ApiErrors.badRequest(
          parsed.error.issues[0]?.message || "Input tidak valid",
        );
      }

      const service = new AcsDeviceService();
      const result = await service.createTask(deviceId, parsed.data);
      if ("data" in result) return apiSuccess(result.data);
      if (result.status === "badRequest")
        return ApiErrors.badRequest(result.message);
      return ApiErrors.internalError(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating ACS task:", message);
      return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${message}`);
    }
  },
);
