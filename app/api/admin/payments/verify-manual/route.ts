import { logger } from "@/lib/logger";
import { z } from "zod";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import {
  ManualPaymentAdminRouteService,
  isRouteServiceError,
} from "@/modules/finance";
import { checkSiteRestriction } from "@/modules/roles";

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

const verifyManualPaymentSchema = z.object({
  paymentId: z.string().min(1, "paymentId wajib diisi"),
  action: z.enum(["approve", "reject"], {
    message: "Action harus 'approve' atau 'reject'",
  }),
  notes: z.string().optional(),
});

export const POST = createHandler(
  {
    auth: true,
    permissions: ["manual_payments:verify"],
    schema: verifyManualPaymentSchema,
  },
  async (_req, ctx) => {
    try {
      const { isRestricted, siteIds } = checkSiteRestriction(
        ctx.session as never,
        "finance",
      );
      const allowedSiteIds = isRestricted ? siteIds : undefined;

      const result = await manualPaymentAdminRouteService.verifyManualPayment({
        paymentId: ctx.validated.paymentId,
        action: ctx.validated.action,
        notes: ctx.validated.notes,
        allowedSiteIds,
      });

      return apiSuccess(result);
    } catch (e) {
      const error = e as Error;
      logger.error("Error verifying manual payment:", error);
      if (isRouteServiceError(error)) {
        return ApiErrors.badRequest(error.message);
      }
      return ApiErrors.internalError("Internal Server Error");
    }
  },
);
