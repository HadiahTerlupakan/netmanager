import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { setCustomerAuthCookies } from "@/lib/customer-auth";
import { CustomerAuthService } from "@/modules/pelanggan";
import { rateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import {
  logSecurityEvent,
  trackFailedLogin,
  blockIp,
  isIpBlocked,
  getBlockTimeRemaining,
  resetFailedLoginCounter,
} from "@/lib/security-logger";

const authService = new CustomerAuthService();

/**
 * POST - Customer login endpoint
 * Refactored to use CustomerAuthService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check if IP is blocked
    if (await isIpBlocked(ip)) {
      const remainingTime = await getBlockTimeRemaining(ip);

      logSecurityEvent({
        type: "rate_limit_exceeded",
        ipAddress: ip,
        userAgent,
        severity: "high",
        details: {
          endpoint: "/api/customer/auth/login",
          remainingBlockTime: remainingTime,
        },
      });

      return apiError(
        `IP diblokir sementara. Coba lagi dalam ${Math.ceil(remainingTime / 60)} menit.`,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        { status: 429 },
      );
    }

    // Rate limiting: max 5 login attempts per minute
    if (!rateLimit(ip, RATE_LIMITS.login)) {
      logSecurityEvent({
        type: "rate_limit_exceeded",
        ipAddress: ip,
        userAgent,
        severity: "medium",
        details: {
          endpoint: "/api/customer/auth/login",
          limit: RATE_LIMITS.login,
        },
      });

      return apiError(
        "Terlalu banyak percobaan login. Coba lagi dalam 1 menit.",
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        { status: 429 },
      );
    }

    const body = await request.json();
    const { identifier, password } = body;

    const result = await authService.login(identifier, password);

    if (!result.success) {
      // Track failed login attempt
      const failedCount = await trackFailedLogin(ip);

      // Log failed login
      logSecurityEvent({
        type: "failed_login",
        ipAddress: ip,
        userAgent,
        severity: failedCount >= 5 ? "high" : "medium",
        details: {
          endpoint: "/api/customer/auth/login",
          identifier,
          reason: result.error,
          attemptCount: failedCount,
        },
      });

      // Auto-block IP after 5 failed attempts
      if (failedCount >= 5) {
        await blockIp(ip, 3600); // Block for 1 hour
      }

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

    // Reset failed login counter on successful login
    await resetFailedLoginCounter(ip);

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
