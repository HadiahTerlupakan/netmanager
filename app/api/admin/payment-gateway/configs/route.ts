import { getPaymentGatewayConfigService } from "@/modules/finance";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

const service = getPaymentGatewayConfigService();

export const GET = createHandler(
  { auth: true, feature: "payment-gateway" },
  async (_req, _ctx) => {
    // Permission check
    if (!(await hasPermission("payment_gateway:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat payment gateway",
      );
    }

    const result = await service.listConfigs();
    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result.data);
  },
);
