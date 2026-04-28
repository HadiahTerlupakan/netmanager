import { headers } from "next/headers";
import { autoApproveTukarLibur } from "@/modules/attendance";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  try {
    const env = getEnv();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const result = await autoApproveTukarLibur();

    return apiSuccess(
      {
        ...result,
        timestamp: new Date().toISOString(),
      },
      { message: "Auto-approve leave berhasil dijalankan" },
    );
  } catch (error: unknown) {
    logger.error("[Cron Auto-Approve Leave] Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Gagal menjalankan auto-approve leave";
    return ApiErrors.internalError(errorMessage);
  }
}

export async function GET(_request: Request) {
  return POST(_request);
}
