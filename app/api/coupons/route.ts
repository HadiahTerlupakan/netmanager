import { ZodError } from "zod";

import { couponService, createCouponSchema } from "@/modules/coupons";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
  if (!(await hasPermission("coupon:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kupon",
    );
  }

  const result = await couponService.getAllCoupons();
  return apiSuccess(result.items);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("coupon:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat kupon");
  }

  try {
    const payload = createCouponSchema.parse(await req.json());
    const coupon = await couponService.createCoupon({
      ...payload,
      code: payload.code.toUpperCase(),
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Coupon",
      details: { id: coupon.id, code: coupon.code },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(coupon, {
      status: 201,
      message: "Kupon berhasil dibuat",
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(
        error.issues[0]?.message ?? "Input kupon tidak valid",
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Gagal membuat kupon";
    if (errorMessage === "Coupon code already exists") {
      return ApiErrors.conflict(
        "Kode kupon sudah digunakan, silakan gunakan kode lain",
      );
    }
    return ApiErrors.internalError(errorMessage);
  }
});
