import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AcsDeviceService } from "@/modules/network";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { auth: true, permissions: ["acs:read"] },
  async () => {
    const service = new AcsDeviceService();
    const result = await service.listDevices();
    if (!result.ok) return ApiErrors.badGateway(result.message);
    return apiSuccess(result.data);
  },
);
