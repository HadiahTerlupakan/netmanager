import { NextRequest } from "next/server";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { revokePelangganSession } from "@/lib/jwt";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getInvestorMobileSession } from "@/lib/mobile-investor-auth";
import { getMobileInvestorAuthService } from "@/modules/investor";
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
    // Pelanggan memakai access token portal (bukan token mobile karyawan), yang
    // ditolak `getMobileAuthPayload`. Tangani lebih dulu dan akhiri hanya sesi
    // perangkat ini, supaya portal web pelanggan tetap masuk.
    const bearer = request.headers
      .get("authorization")
      ?.replace(/^Bearer /, "");
    if (bearer && (await revokePelangganSession(bearer))) {
      return apiSuccess({ message: "Logout berhasil" });
    }

    const investorSession = await getInvestorMobileSession(request);
    if (investorSession) {
      await getMobileInvestorAuthService().logout(investorSession.id);
      return apiSuccess({ message: "Logout berhasil" });
    }

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
