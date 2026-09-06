import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltOnuService, OltProvisioningService } from "@/modules/olt";

const onuService = new OltOnuService();
const provisioning = new OltProvisioningService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const onu = await onuService.getOnuById(id, session.user.tenantId);
    if (!onu) return ApiErrors.notFound("ONU");

    return apiSuccess(onu);
  } catch (error) {
    logger.error("Error fetching ONU:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil data ONU";
    return ApiErrors.internalError(msg);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:delete"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const result = await provisioning.deregisterOnu(
      id,
      session.user.tenantId,
      session.user.id,
    );
    if (!result.success) {
      return ApiErrors.internalError(result.error ?? "Gagal hapus ONU");
    }
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Error deleting ONU:", error);
    const msg = error instanceof Error ? error.message : "Gagal menghapus ONU";
    return ApiErrors.internalError(msg);
  }
}
