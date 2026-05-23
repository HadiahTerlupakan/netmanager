import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltCommandLogService } from "@/modules/olt";

const commandLog = new OltCommandLogService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_logs:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);

    const result = await commandLog.findByTenant(
      session.user.tenantId,
      page,
      limit,
    );
    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching command logs:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengambil data";
    return ApiErrors.internalError(msg);
  }
}
