import { NextResponse } from "next/server";

import { isRouteServiceError } from "@/lib/api/route-service-error";
import { apiError, apiSuccess, ApiErrors, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  requireInvestorMobileSession,
  type InvestorMobileSession,
} from "@/lib/mobile-investor-auth";

const STATUS_TIDAK_DITEMUKAN = 404;

/**
 * Kerangka endpoint baca `/api/mobile/investor/*`: wajib token investor
 * mobile, lalu data dari service dibungkus `apiSuccess`. Galat service
 * (mis. proyek bukan milik investor → 404) diteruskan apa adanya; galat lain
 * jadi 500 tanpa detail internal.
 */
export async function jalankanRuteInvestorMobile(
  request: Request,
  label: string,
  ambilData: (session: InvestorMobileSession) => Promise<unknown>,
): Promise<NextResponse> {
  const session = await requireInvestorMobileSession(request);
  if (session instanceof NextResponse) return session;

  try {
    return apiSuccess(await ambilData(session));
  } catch (error) {
    if (isRouteServiceError(error)) {
      const kode =
        error.status === STATUS_TIDAK_DITEMUKAN
          ? ErrorCodes.NOT_FOUND
          : ErrorCodes.VALIDATION_ERROR;
      return apiError(error.message, kode, { status: error.status });
    }
    logger.error(`[MOBILE_INVESTOR] ${label} gagal:`, error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
