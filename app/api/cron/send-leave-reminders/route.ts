import { NextRequest } from "next/server";
import { sendLeaveReminders } from "@/modules/attendance";
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

    const lockResult = await acquireCronLock("sendLeaveReminders", 3600);
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

    const result = await sendLeaveReminders();

    return apiSuccess(
      { data: result },
      { message: "Leave reminders berhasil dikirim" },
    );
  } catch (error) {
    logger.error("Error sending leave reminders:", error);
    return ApiErrors.internalError("Gagal mengirim leave reminders");
  }
}
