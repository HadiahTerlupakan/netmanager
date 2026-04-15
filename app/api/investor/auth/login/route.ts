import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";

import { prismaAuth } from "@/modules/database";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import {
  checkStrictLoginRateLimit,
  isLoginRateLimitEnabled,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "@/lib/security/login-rate-limit";

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

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

    // Find investor
    const investor = await prismaAuth.investor.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: "insensitive",
        },
      },
    });

    if (!investor) {
      console.log(
        `[INVESTOR_LOGIN] Investor not found for username: ${normalizedUsername}`,
      );
      return apiError("Username atau Password salah", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    if (!investor.isActive) {
      return apiError(
        "Akun dinonaktifkan. Silakan hubungi Admin.",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    // Verify password
    if (
      !investor.passwordHash ||
      !(await compare(password, investor.passwordHash))
    ) {
      console.log(
        `[INVESTOR_LOGIN] Invalid credentials for username: ${normalizedUsername}`,
      );
      return apiError("Username atau Password salah", ErrorCodes.UNAUTHORIZED, {
        status: 401,
      });
    }

    console.log(
      `[INVESTOR_LOGIN] Login successful for: ${normalizedUsername}, tenantId: ${investor.tenantId}`,
    );

    // Generate JWT Token
    const payload = {
      id: investor.id,
      username: investor.username,
      namaLengkap: investor.namaLengkap,
      role: "INVESTOR",
      tenantId: investor.tenantId,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());

    // Set HTTP-only cookie via raw header for maximum compatibility
    const isSecure = process.env.NODE_ENV === "production";
    const cookieParts = [
      `investor_auth_token=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 7}`,
      ...(isSecure ? ["Secure"] : []),
    ];
    const response = apiSuccess(
      { user: payload },
      {
        message: "Login berhasil",
        headers: { "Set-Cookie": cookieParts.join("; ") },
      },
    );

    return response;
  } catch (error) {
    console.error("[INVESTOR_LOGIN] Error:", error);
    return apiError(
      "Terjadi kesalahan pada server",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
