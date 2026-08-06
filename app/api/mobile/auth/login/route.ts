import { logger } from "@/lib/logger";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { loginMobileRoute } from "@/modules/users";
import { rateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import {
  logSecurityEvent,
  isIpBlocked,
  getBlockTimeRemaining,
} from "@/lib/security-logger";

/** Menangani login mobile untuk employee, customer, dan mitra. */
export async function POST(req: Request) {
  const ip = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

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
          endpoint: "/api/mobile/auth/login",
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
          endpoint: "/api/mobile/auth/login",
          limit: RATE_LIMITS.login,
        },
      });

      return apiError(
        "Terlalu banyak percobaan login. Coba lagi dalam 1 menit.",
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        { status: 429 },
      );
    }

    const body = await req.json();
    return loginMobileRoute({
      email: body.email,
      password: body.password,
      versionCode: parseVersionCode(body.versionCode),
      versionName: body.versionName || null,
      otaUpdateId:
        typeof body.otaUpdateId === "string" ? body.otaUpdateId : null,
      loginType: body.loginType || "EMPLOYEE",
    });
  } catch (error) {
    logger.error("Mobile Login Error:", error);
    return apiError(
      "Terjadi kesalahan server. Silakan coba lagi.",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

function parseVersionCode(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
