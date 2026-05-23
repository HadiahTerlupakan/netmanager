import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";
import { testEmailSettings, type EmailTestPayload } from "@/modules/settings";

export const POST = createHandler(
  { auth: true, permissions: ["email:update"] },
  async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    let payload: EmailTestPayload = {};
    try {
      const parsed = await req.json();
      if (parsed) payload = parsed;
    } catch (error) {
      logger.warn("Invalid JSON received for email test", {
        tenantId,
        userId: ctx.session!.user.id,
        parseError: error instanceof Error ? error.message : error,
      });
      return ApiErrors.badRequest("Payload pengiriman email tidak valid");
    }

    const result = await testEmailSettings({
      tenantId,
      userId: ctx.session!.user.id,
      payload,
    });

    if (result.type === "validation_error") {
      return ApiErrors.badRequest(result.message);
    }

    if (result.type === "failure") {
      return ApiErrors.internalError(result.message);
    }

    return apiSuccess(result.data, { message: result.message });
  },
);
