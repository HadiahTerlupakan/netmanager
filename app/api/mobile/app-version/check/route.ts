import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getInvestorMobileSession } from "@/lib/mobile-investor-auth";
import {
  getAppReleaseServices,
  versionCheckQuerySchema,
} from "@/modules/app-version";

const UNAUTHENTICATED_STATUS = 401;
const APP_VERSION_UNSUPPORTED_STATUS = 426;
const ANONYMOUS_STATUSES = new Set([
  UNAUTHENTICATED_STATUS,
  APP_VERSION_UNSUPPORTED_STATUS,
]);

/** Tenant pemanggil: akun investor (token sendiri) atau karyawan/mitra/pelanggan. */
async function resolveTenantPemanggil(
  request: NextRequest,
): Promise<string | undefined | NextResponse> {
  const investor = await getInvestorMobileSession(request);
  if (investor) return investor.tenantId ?? undefined;
  const auth = await getMobileAuthPayload(request);
  // Aplikasi yang versinya sudah ditolak (426) atau sedang di layar login
  // (401) justru harus tetap bisa menanyakan apa yang perlu dipasang: tanpa
  // jawaban ini build lama tidak pernah menampilkan Update Wajib dan
  // penggunanya terus menekan Sign In sampai terkena batas login (429).
  // Isinya publik (versi terbaru, tautan Play Store); tanpa tenant, kontak
  // admin global yang dipakai.
  if (auth instanceof NextResponse) {
    return ANONYMOUS_STATUSES.has(auth.status) ? undefined : auth;
  }
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
