import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuDiscoveryService } from "@/modules/olt";

const discoveryService = new OnuDiscoveryService();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const result = await discoveryService.discoverByOlt(id);

    if (!result.success) {
      return apiSuccess({ found: 0, error: result.error });
    }

    return apiSuccess({ found: result.data });
  } catch (error) {
    logger.error("Error scanning OLT:", error);
    const msg = error instanceof Error ? error.message : "Gagal scan OLT";
    return ApiErrors.internalError(msg);
  }
}
