import { logger } from "@/lib/logger";
import { ZodError } from "zod";

import { couponService, verifyCouponSchema } from "@/modules/coupons";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

// Rute staf: pelanggan memakai /api/customer/coupons/verify. `pelangganId`
// dari body tidak dipercaya untuk apa pun dan dibuang.
const staffVerifyCouponSchema = verifyCouponSchema.omit({ pelangganId: true });

export const POST = createHandler(
  { auth: true, permissions: ["coupon:read"] },
  async (req, ctx) => {
    try {
      const payload = staffVerifyCouponSchema.parse(await req.json());
      const tenantId = ctx.session!.user.tenantId ?? null;
      const result = await couponService.verifyCoupon(
        payload.code,
        payload.amount,
        undefined,
        tenantId,
      );

      if (!result.valid) {
        return ApiErrors.badRequest(result.error || "Kupon tidak valid");
      }

      return apiSuccess({
        valid: true,
        code: payload.code.toUpperCase(),
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount,
        couponId: result.couponId,
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return ApiErrors.badRequest(
          error.issues[0]?.message ?? "Input verifikasi kupon tidak valid",
        );
      }

      logger.error("Coupon verify error:", error);
      const message =
        error instanceof Error ? error.message : "Gagal memverifikasi kupon";
      return ApiErrors.internalError(message);
    }
  },
);
