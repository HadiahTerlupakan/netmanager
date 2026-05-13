import { NextRequest } from "next/server";
import {
  apiError,
  ApiErrors,
  apiSuccess,
  ErrorCodes,
} from "@/lib/api-response";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";
import { PendingPackageApplierService } from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock("route:applyPendingPackages", 55);

    if (lockResult === "unavailable") {
      return apiError(
        CRON_LOCK_UNAVAILABLE_MESSAGE,
        ErrorCodes.INTERNAL_ERROR,
        { status: 503 },
      );
    }

    if (lockResult === "locked") {
      return apiSuccess(
        { skipped: true, reason: "Lock already held" },
        { message: "Apply pending packages sedang berjalan di runtime lain" },
      );
    }

    const result = await new PendingPackageApplierService().applyDuePending();

    return apiSuccess(result, {
      message: `Applied ${result.applied} pending packages, ${result.failed} failed`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    logger.error(
      "[Cron applyPendingPackages] Error:",
      error instanceof Error ? error : undefined,
    );
    return ApiErrors.internalError(message);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
