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
import { BillingScheduleReconciliationService } from "@/modules/finance";

export const dynamic = "force-dynamic";

/** Menjalankan recovery schedule billing yang hilang atau terlewat secara aman. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock(
      "route:billingScheduleReconciliation",
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
        },
        {
          message:
            "Billing schedule reconciliation sedang berjalan di runtime lain",
        },
      );
    }

    const result = await new BillingScheduleReconciliationService().reconcile();

    return apiSuccess(result, {
      message: "Billing schedule reconciliation berhasil dijalankan",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
