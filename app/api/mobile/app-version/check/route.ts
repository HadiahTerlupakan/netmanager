import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  AppReleaseRepository,
  AppVersionCheckService,
  versionCheckQuerySchema,
} from "@/modules/app-version";
import { getAppUpdateContact } from "@/modules/settings";

const repository = new AppReleaseRepository();
const versionCheckService = new AppVersionCheckService(
  repository,
  getAppUpdateContact,
);

/** GET /api/mobile/app-version/check — cek apakah versi APK perlu update */
export async function GET(request: NextRequest) {
  try {
    const auth = await getMobileAuthPayload(request);
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId as string | undefined;

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = versionCheckQuerySchema.safeParse(params);
    if (!parsed.success) {
      return apiError("Parameter tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.format() as Record<string, unknown>,
      });
    }

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
