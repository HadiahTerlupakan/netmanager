import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import {
  clearCustomerAuthCookies,
  CUSTOMER_ACCESS_TOKEN_COOKIE,
  CUSTOMER_REFRESH_TOKEN_COOKIE,
} from "@/lib/customer-auth";
import { revokePelangganSession } from "@/lib/jwt";

/**
 * Refresh token didahulukan: access token sering sudah kedaluwarsa saat
 * pelanggan menekan logout, sedangkan yang harus mati adalah refresh token.
 */
function readLogoutToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  return (
    request.cookies.get(CUSTOMER_REFRESH_TOKEN_COOKIE)?.value ??
    request.cookies.get(CUSTOMER_ACCESS_TOKEN_COOKIE)?.value ??
    (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Hanya sesi perangkat ini yang diakhiri; aplikasi mobile dan browser lain
    // milik pelanggan yang sama tetap masuk.
    const token = readLogoutToken(request);
    if (token) {
      await revokePelangganSession(token);
    }

    // Create response
    const response = apiSuccess(null, { message: "Logout berhasil" });

    // Clear auth cookies
    clearCustomerAuthCookies(response);

    return response;
  } catch (error) {
    logger.error("[Customer Logout Error]:", error);

    // Still clear cookies even on error
    const response = apiSuccess(null, { message: "Logout berhasil" });
    clearCustomerAuthCookies(response);

    return response;
  }
}
