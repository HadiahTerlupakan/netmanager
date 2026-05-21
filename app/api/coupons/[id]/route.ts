import { ZodError } from "zod";

import { couponService, updateCouponSchema } from "@/modules/coupons";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("coupon:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kupon",
    );
  }

  const { id } = ctx.params;
  const coupon = await couponService.getCouponById(id);

  if (!coupon) {
    return ApiErrors.notFound("Kupon");
  }

  return apiSuccess(coupon);
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("coupon:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah kupon",
    );
  }

  const { id } = ctx.params;

  try {
    const payload = updateCouponSchema.parse(await req.json());
    const coupon = await couponService.updateCoupon(id, payload);

    await logger.logActivity({
      action: "UPDATE",
      subject: "Coupon",
      details: { id, changes: Object.keys(payload) },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(coupon, { message: "Kupon berhasil diperbarui" });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest(
        error.issues[0]?.message ?? "Input kupon tidak valid",
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Gagal mengubah kupon";
    if (errorMessage === "Coupon not found") {
      return ApiErrors.notFound("Kupon");
    }
    return ApiErrors.internalError(errorMessage);
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("coupon:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus kupon",
    );
  }

  const { id } = ctx.params;

  try {
    await couponService.deleteCoupon(id);

    await logger.logActivity({
      action: "DELETE",
      subject: "Coupon",
      details: { id },
      userId: ctx.session!.user.id,
    });

    return apiSuccess(null, { message: "Kupon berhasil dihapus" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Gagal menghapus kupon";
    if (errorMessage === "Coupon not found") {
      return ApiErrors.notFound("Kupon");
    }
    if (errorMessage.includes("has been used")) {
      return apiError(
        "Kupon tidak bisa dihapus karena sudah pernah digunakan",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    return ApiErrors.internalError(errorMessage);
  }
});
