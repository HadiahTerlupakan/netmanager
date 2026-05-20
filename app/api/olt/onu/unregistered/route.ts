import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltOnuService } from "@/modules/olt";

const onuService = new OltOnuService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const oltId = searchParams.get("oltId") ?? undefined;

    const data = await onuService.listUnregistered(
      session.user.tenantId,
      oltId,
    );
    return apiSuccess(data);
  } catch (error) {
    logger.error("Error fetching unregistered ONUs:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengambil data";
    return ApiErrors.internalError(msg);
  }
}
