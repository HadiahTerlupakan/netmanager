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
      const result = await service.createTask(deviceId, await req.json());
      if (result.ok) return apiSuccess(result.data);
      if (result.status === "badRequest")
        return ApiErrors.badRequest(result.message);
      return ApiErrors.internalError(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error creating ACS task:", message);
      return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${message}`);
    }
  },
);
