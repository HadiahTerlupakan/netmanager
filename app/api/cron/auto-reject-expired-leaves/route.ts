import { NextRequest } from "next/server";
import { autoRejectExpiredLeaves } from "@/modules/attendance";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const env = getEnv();
    const authHeader = request.headers.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock("autoRejectExpiredLeaves", 3600);
    if (lockResult === "unavailable") {
      return apiError(
        CRON_LOCK_UNAVAILABLE_MESSAGE,
        ErrorCodes.INTERNAL_ERROR,
        { status: 503 },
      );
    }
    if (lockResult === "locked") {
      return apiSuccess({ skipped: true, reason: "Lock already held" });
    }

    const result = await autoRejectExpiredLeaves();

    return apiSuccess(
      { data: result },
      { message: "Auto-reject berhasil dijalankan" },
    );
  } catch (error) {
    logger.error("Error running auto-reject expired leaves:", error);
    return ApiErrors.internalError("Gagal menjalankan auto-reject");
  }
}
