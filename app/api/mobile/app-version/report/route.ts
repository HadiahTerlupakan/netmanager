import { logger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getAppVersionService } from "@/modules/app-version";

/** Mencatat versi aplikasi terakhir yang dipakai user mobile. */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const body = await req.json();
    const appVersionService = await getAppVersionService();

    if (!body.versionCode) {
      return apiError("versionCode wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    await appVersionService.reportMobileVersion({
      sessionUserId: authResult.id as string,
      tenantId: authResult.tenantId as string | null | undefined,
      role: authResult.role,
      versionCode: body.versionCode,
      versionName: body.versionName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.includes("versionCode harus berupa angka bulat positif")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    logger.error("Error reporting app version:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
