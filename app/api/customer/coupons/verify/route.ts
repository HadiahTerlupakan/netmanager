import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { couponService, verifyCouponSchema } from "@/modules/coupons";

// `pelangganId` dibuang dari payload: pelanggan hanya boleh memverifikasi
// kupon atas namanya sendiri, jadi id selalu diambil dari sesi.
const customerVerifyCouponSchema = verifyCouponSchema.omit({
  pelangganId: true,
});

/** Memverifikasi kupon untuk pelanggan yang sedang login di portal. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const parsed = customerVerifyCouponSchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiErrors.badRequest(
        parsed.error.issues[0]?.message ?? "Input verifikasi kupon tidak valid",
      );
    }

    // `findByCode` tanpa tenantId mencari di semua tenant; tolak daripada
    // membiarkan pelanggan memakai kupon milik ISP lain.
    const { tenantId } = await getTenantIdFromContext();
    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID tidak ditemukan");
    }

    const { code, amount } = parsed.data;
    const result = await couponService.verifyCoupon(
      code,
      amount,
      authResult.session.id,
      tenantId,
    );
    if (!result.valid) {
      return ApiErrors.badRequest(result.error || "Kupon tidak valid");
    }

    return apiSuccess({
      valid: true,
      code: code.toUpperCase(),
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
    });
  } catch (error) {
    logger.error("[Customer Coupon Verify Error]:", error);
    return ApiErrors.internalError("Gagal memverifikasi kupon");
  }
}
