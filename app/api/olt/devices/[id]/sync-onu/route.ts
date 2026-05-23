import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuDiscoveryService } from "@/modules/olt";

const discoveryService = new OnuDiscoveryService();

/**
 * Import registered ONU dari OLT ke DB app.
 * Berguna saat OLT pertama kali ditambahkan dan sudah punya banyak ONU
 * teregistrasi yang perlu dikenali sistem agar bisa di-monitor & kontrol.
 */
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
    const result = await discoveryService.syncRegisteredOnusFromOlt(
      id,
      session.user.tenantId,
    );

    if (!result.success) {
      return apiSuccess({ imported: 0, total: 0, error: result.error });
    }

    return apiSuccess(result.data);
  } catch (error) {
    logger.error("Error syncing registered ONUs:", error);
    const msg = error instanceof Error ? error.message : "Sync ONU gagal";
    return ApiErrors.internalError(msg);
  }
}
