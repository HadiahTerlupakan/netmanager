import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { setCustomerAuthCookies } from "@/lib/customer-auth";
import { CustomerAuthService } from "@/modules/pelanggan";

const authService = new CustomerAuthService();

/**
 * POST - Customer login endpoint
 * Refactored to use CustomerAuthService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    const result = await authService.login(identifier, password);

    if (!result.success) {
      // Determine status code
      let statusCode = 401;
      if (result.error?.includes("harus diisi")) statusCode = 400;
      if (result.error?.includes("Terlalu banyak")) statusCode = 429;
      if (
        result.error?.includes("belum diaktifkan") ||
        result.error?.includes("tidak aktif")
      )
        statusCode = 403;

      return apiError(result.error ?? "Login gagal", ErrorCodes.UNAUTHORIZED, {
        status: statusCode,
      });
    }

    // Success response
    const response = apiSuccess(
      { customer: result.customer },
      { message: "Login berhasil" },
    );

    // Set auth cookies
    if (result.tokens) {
      setCustomerAuthCookies(
        response,
        result.tokens.accessToken,
        result.tokens.refreshToken,
      );
    }

    return response;
  } catch (error) {
    logger.error("[Customer Login Error]:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
