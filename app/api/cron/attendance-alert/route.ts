import { NextRequest } from "next/server";
import {
  processCheckInReminders,
  processCheckOutReminders,
  processIncompleteAttendance,
  runScheduledAttendanceCheck,
} from "@/modules/attendance";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";

function getAttendanceAlertLock(type: string): {
  jobName: string;
  ttlSeconds: number;
} {
  switch (type) {
    case "checkin":
      return { jobName: "route:attendanceAlert:checkin", ttlSeconds: 10 * 60 };
    case "checkout":
      return { jobName: "route:attendanceAlert:checkout", ttlSeconds: 10 * 60 };
    case "process":
      return { jobName: "route:attendanceAlert:process", ttlSeconds: 60 * 60 };
    case "auto":
    default:
      return { jobName: "route:attendanceAlert:auto", ttlSeconds: 10 * 60 };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      // console.log('[Cron] Unauthorized access attempt')
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "auto";

    const { jobName, ttlSeconds } = getAttendanceAlertLock(type);
    const lockResult = await acquireCronLock(jobName, ttlSeconds);
    if (lockResult === "unavailable") {
      return apiError(
        CRON_LOCK_UNAVAILABLE_MESSAGE,
        ErrorCodes.INTERNAL_ERROR,
        { status: 503 },
      );
    }

    if (lockResult === "locked") {
      return apiSuccess(
        {
          type,
          skipped: true,
          reason: "Lock already held",
        },
        { message: "Attendance alert sedang berjalan di runtime lain" },
      );
    }

    let result: Record<string, unknown> | undefined;

    switch (type) {
      case "checkin":
        result = await processCheckInReminders();
        return apiSuccess({
          type: "checkin_reminder",
          ...result,
        });

      case "checkout":
        result = await processCheckOutReminders();
        return apiSuccess({
          type: "checkout_reminder",
          ...result,
        });

      case "process":
        result = await processIncompleteAttendance();
        return apiSuccess({
          type: "process_incomplete",
          ...result,
        });

      case "auto":
      default:
        result = await runScheduledAttendanceCheck();
        return apiSuccess({
          type: "auto_scheduled",
          timestamp: new Date().toISOString(),
          ...result,
        });
    }
  } catch (error: unknown) {
    console.error("[Cron] Attendance alert error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}
