import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getInvestorMobileSession } from "@/lib/mobile-investor-auth";
import {
  getAppReleaseServices,
  versionCheckQuerySchema,
} from "@/modules/app-version";

/** Tenant pemanggil: akun investor (token sendiri) atau karyawan/mitra/pelanggan. */
async function resolveTenantPemanggil(
  request: NextRequest,
): Promise<string | undefined | NextResponse> {
  const investor = await getInvestorMobileSession(request);
  if (investor) return investor.tenantId ?? undefined;
  const auth = await getMobileAuthPayload(request);
  if (auth instanceof NextResponse) return auth;
  return auth.tenantId as string | undefined;
}

/** GET /api/mobile/app-version/check — cek apakah versi APK perlu update */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantPemanggil(request);
    if (tenantId instanceof NextResponse) return tenantId;

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = versionCheckQuerySchema.safeParse(params);
    if (!parsed.success) {
      return apiError("Parameter tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: { issues: parsed.error.issues } as unknown as Record<
          string,
          unknown
        >,
      });
    }

    const { versionCheckService } = await getAppReleaseServices();
    const result = await versionCheckService.check({
      platform: parsed.data.platform,
      currentVersion: parsed.data.currentVersion,
      currentVersionCode: parsed.data.currentVersionCode,
      tenantId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Mobile App Version Check Error:", error);
    return apiError("Gagal cek versi aplikasi", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
