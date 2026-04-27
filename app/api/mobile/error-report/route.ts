import { NextRequest, NextResponse } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { submitMobileErrorReport } from "@/modules/notification";

/** Menerima laporan error dari aplikasi mobile dan menyimpannya ke log. */
export async function POST(request: NextRequest) {
  try {
    await submitMobileErrorReport(request);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }

    logger.error(
      "Mobile error report route failed",
      error instanceof Error ? error : undefined,
      {
        route: "/api/mobile/error-report",
      },
    );
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
