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
import { logger } from "@/lib/logger";
import { AutomaticIsolationService } from "@/modules/finance";

export const dynamic = "force-dynamic";

/**
 * @deprecated Gunakan `/api/cron/reconcile-billing-schedules` sebagai canonical
 * endpoint. Route ini dipertahankan hanya untuk backward-compatibility dan
 * akan dihapus pada rilis berikutnya. Logika eksekusi delegasi ke
 * `BillingScheduleReconciliationService` lewat `AutomaticIsolationService`.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    logger.warn(
      "[Cron process-overdue] Endpoint deprecated — beralih ke /api/cron/reconcile-billing-schedules",
    );

    const lockResult = await acquireCronLock(
      "route:processOverdueCompatibility",
      55,
    );
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
          skipped: true,
          reason: "Lock already held",
          mode: "compatibility",
          deprecated: true,
        },
        {
          message:
            "Process overdue compatibility sedang berjalan di runtime lain",
        },
      );
    }

    const result = await AutomaticIsolationService.runDailyCheck();

    return apiSuccess(
      {
        mode: "compatibility",
        deprecated: true,
        ...result,
      },
      {
        message:
          "Process overdue compatibility berhasil meneruskan ke billing schedule reconciliation",
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
