import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltAlertService } from "@/modules/olt";

const alertService = new OltAlertService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_logs:read")))
      return ApiErrors.forbidden("Anda tidak memiliki akses");

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const result = await alertService.getAlerts(
      session.user.tenantId,
      page,
      limit,
      unreadOnly,
    );
    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    return ApiErrors.internalError("Gagal mengambil data");
  }
}
