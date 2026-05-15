import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  AppVersionValidationError,
  getAppVersionService,
  reportMobileVersionSchema,
} from "@/modules/app-version";

export const dynamic = "force-dynamic";

/** Mencatat versi aplikasi terakhir yang dipakai user mobile. */
export async function POST(req: NextRequest) {
  const authResult = await getMobileAuthPayload(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const body = await req.json().catch((): unknown => null);
  const parsed = reportMobileVersionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Data input tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400, details: { issues: parsed.error.issues } },
    );
  }

  try {
    const service = await getAppVersionService();
    await service.reportMobileVersion({
      sessionUserId: authResult.id as string,
      tenantId: authResult.tenantId as string | null | undefined,
      role: authResult.role,
      versionCode: parsed.data.versionCode,
      versionName: parsed.data.versionName ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppVersionValidationError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    logger.error("Error reporting app version:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
