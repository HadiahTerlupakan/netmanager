import { logger } from "@/lib/logger";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import {
  cancelPaidPayment,
  PaymentCancellationError,
  resolveManualPaymentAllowedSiteIds,
} from "@/modules/finance";

export const POST = createHandler(
  { auth: true, permissions: ["manual_payments:verify"] },
  async (_req, ctx) => {
    try {
      const allowedSiteIds = resolveManualPaymentAllowedSiteIds(
        ctx.session!.user,
        ctx.permissions,
      );

      const { id: paymentId } = ctx.params;
      await cancelPaidPayment({
        paymentId,
        adminLabel:
          ctx.session!.user.name || ctx.session!.user.email || "Admin",
        allowedSiteIds,
      });

      return apiSuccess({ message: "Payment cancelled successfully" });
    } catch (error: unknown) {
      if (error instanceof PaymentCancellationError) {
        return ApiErrors.badRequest(error.message);
      }

      logger.error("Error cancelling payment:", error);
      return ApiErrors.internalError("Terjadi kesalahan internal server");
    }
  },
);
