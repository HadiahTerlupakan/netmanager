import { NextRequest } from "next/server";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { performMobileLogout } from "@/modules/users";

/**
 * Logout mobile — delegasi ke service layer (no-restricted-imports
 * mencegah API route akses Prisma langsung).
 *
 * Tanpa endpoint ini, refresh token tetap valid 30 hari setelah user
 * logout. Token bocor tidak bisa dicabut sampai user re-login.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof Response) return authResult;

    await performMobileLogout({
      userId: authResult.id as string,
      role: authResult.role ?? "USER",
    });

    return apiSuccess({ message: "Logout berhasil" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal melakukan logout";
    logger.error("[mobile/auth/logout] error:", error);
    return ApiErrors.internalError(message);
  }
}
