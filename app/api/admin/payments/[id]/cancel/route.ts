import { logger } from "@/lib/logger";
import {
  ApiErrors,
  apiSuccess,
  createHandler,
  buildSessionWithPermissions,
} from "@/lib/api";
import { cancelPaidPayment, PaymentCancellationError } from "@/modules/finance";
import { checkSiteRestriction } from "@/modules/roles";

export const POST = createHandler(
  { auth: true, permissions: ["manual_payments:verify"] },
  async (_req, ctx) => {
    try {
      const { isRestricted, siteIds } = checkSiteRestriction(
        buildSessionWithPermissions(ctx.session!, ctx.permissions),
        "finance",
      );
      const allowedSiteIds = isRestricted ? siteIds : undefined;

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
