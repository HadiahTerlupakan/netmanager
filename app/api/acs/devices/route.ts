import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService } from "@/modules/network";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { auth: true, permissions: ["acs:read"] },
  async () => {
    try {
      const service = new AcsDeviceService();
      const result = await service.listDevices();
      if (!result.ok) return ApiErrors.internalError(result.message);
      return apiSuccess(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error fetching ACS devices:", message);
      return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${message}`);
    }
  },
);
