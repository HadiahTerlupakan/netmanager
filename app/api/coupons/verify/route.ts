import { ZodError } from "zod";

import { couponService, verifyCouponSchema } from "@/modules/coupons";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const POST = createHandler({ auth: false }, async (req, _ctx) => {
  try {
    const payload = verifyCouponSchema.parse(await req.json());
    const result = await couponService.verifyCoupon(
      payload.code,
      payload.amount,
      payload.pelangganId,
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

    console.error("Coupon verify error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal memverifikasi kupon";
    return ApiErrors.internalError(message);
  }
});
