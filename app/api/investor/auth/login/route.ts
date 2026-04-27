import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import {
  checkStrictLoginRateLimit,
  isLoginRateLimitEnabled,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "@/lib/security/login-rate-limit";
import { getInvestorPortalAuthService } from "@/modules/finance";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;
    const normalizedUsername = String(username ?? "")
      .trim()
      .toLowerCase();

    if (!normalizedUsername || !password) {
      return apiError(
        "Username dan Password wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (isLoginRateLimitEnabled()) {
      const rateLimitResult = await checkStrictLoginRateLimit(
        `investor-login:${normalizedUsername}`,
        50,
        300,
      );

      if (rateLimitResult === "unavailable") {
        return apiError(
          LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
          ErrorCodes.INTERNAL_ERROR,
          { status: 503 },
        );
      }

      if (rateLimitResult === "rate_limited") {
        return apiError(
          "Terlalu banyak percobaan. Coba lagi nanti.",
          ErrorCodes.VALIDATION_ERROR,
          { status: 429 },
        );
      }
    }

    const loginResult = await getInvestorPortalAuthService().login({
      username: normalizedUsername,
      password,
    });

    if (loginResult.success === false) {
      const errorCode =
        loginResult.status === 403
          ? ErrorCodes.FORBIDDEN
          : ErrorCodes.UNAUTHORIZED;
      return apiError(loginResult.message, errorCode, {
        status: loginResult.status,
      });
    }

    const isSecure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `investor_auth_token=${loginResult.token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${getInvestorPortalAuthService().getCookieMaxAge()}`,
      ...(isSecure ? ["Secure"] : []),
    ];
    return apiSuccess(
      { user: loginResult.user },
      {
        message: "Login berhasil",
        headers: { "Set-Cookie": cookieParts.join("; ") },
      },
    );
  } catch (error) {
    console.error("[INVESTOR_LOGIN] Error:", error);
    return apiError(
      "Terjadi kesalahan pada server",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
