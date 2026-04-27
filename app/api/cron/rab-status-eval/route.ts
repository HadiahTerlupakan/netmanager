import { headers } from "next/headers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getEnv } from "@/lib/env";
import { getRabStatusEvaluationService } from "@/modules/finance";

export const dynamic = "force-dynamic";

/**
 * Run scheduled RAB status evaluation.
 */
export async function POST(_request: Request) {
  try {
    const env = getEnv();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const rabStatusEvaluationService = getRabStatusEvaluationService();
    const result = await rabStatusEvaluationService.evaluateStatuses();

    return apiSuccess(
      {
        ...result,
        timestamp: new Date().toISOString(),
      },
      { message: "Evaluasi status RAB otomatis berhasil dijalankan" },
    );
  } catch (error: unknown) {
    console.error("[Cron RAB Status] Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Gagal menjalankan evaluasi status RAB";
    return ApiErrors.internalError(errorMessage);
  }
}

/**
 * Proxy GET requests to the cron executor.
 */
export async function GET(_request: Request) {
  return POST(_request);
}
