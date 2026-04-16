import { headers } from "next/headers";
import { AutoCheckoutService } from "@/modules/attendance";
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
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  try {
    const env = getEnv();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock("autoCheckout", 82800);
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
        { message: "Auto-checkout sedang berjalan di runtime lain" },
      );
    }

    const count = await AutoCheckoutService.runAutoCheckout();

    return apiSuccess(
      {
        checkedOutCount: count,
        timestamp: new Date().toISOString(),
      },
      { message: "Auto-checkout berhasil dijalankan" },
    );
  } catch (error: unknown) {
    console.error("Error running auto-checkout:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Gagal menjalankan auto-checkout";
    return ApiErrors.internalError(errorMessage);
  }
}

export async function GET(_request: Request) {
  return POST(_request);
}
