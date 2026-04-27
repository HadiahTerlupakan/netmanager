import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService } from "@/modules/network";

export const dynamic = "force-dynamic";

const service = new AcsDeviceService();

export const GET = createHandler(
  { auth: true, permissions: ["acs:read"] },
  async (_req, ctx) => {
    const deviceId = ctx.params.id;
    if (!deviceId) return ApiErrors.badRequest("Device ID tidak ditemukan");

    try {
      const result = await service.getDeviceDetail(deviceId);
      if (result.ok) return apiSuccess(result.data);
      if (result.status === "notFound")
        return ApiErrors.notFound(result.message);
      return ApiErrors.internalError(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching ACS device detail:", message);
      return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${message}`);
    }
  },
);
