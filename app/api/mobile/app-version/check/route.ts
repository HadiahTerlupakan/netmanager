import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getAppVersionService } from "@/modules/app-version";
import { apiError, ErrorCodes } from "@/lib/api-response";

// GET /api/mobile/app-version/check - Check for updates (Public endpoint)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentVersionCode = parseInt(searchParams.get("versionCode") || "0");
    const platform = searchParams.get("platform") || "android";

    if (!currentVersionCode) {
      return apiError("versionCode wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const service = await getAppVersionService();
    const result = await service.checkForUpdate(currentVersionCode, platform);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logger.error("Error checking app version:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Gagal memeriksa versi";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
