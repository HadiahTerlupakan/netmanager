import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltDeviceService } from "@/modules/olt";

const oltDeviceService = new OltDeviceService();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("olt_devices:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk test koneksi OLT",
      );
    }

    const { id } = await params;
    const result = await oltDeviceService.testConnection(
      id,
      session.user.tenantId,
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ connected: false, error: result.error });
    }

    return apiSuccess({ connected: true });
  } catch (error) {
    logger.error("Error testing OLT connection:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal test koneksi OLT";
    return ApiErrors.internalError(msg);
  }
}
