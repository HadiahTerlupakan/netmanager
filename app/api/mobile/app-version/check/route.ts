import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  checkVersionQuerySchema,
  getAppVersionService,
} from "@/modules/app-version";

export const dynamic = "force-dynamic";

// GET /api/mobile/app-version/check - Check for updates (Public endpoint)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = checkVersionQuerySchema.safeParse({
    versionCode: searchParams.get("versionCode") ?? undefined,
    platform: searchParams.get("platform") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Parameter tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400, details: { issues: parsed.error.issues } },
    );
  }

  try {
    const service = await getAppVersionService();
    const result = await service.checkForUpdate(
      parsed.data.versionCode,
      parsed.data.platform,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("Error checking app version:", error);
    return apiError("Gagal memeriksa versi", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
