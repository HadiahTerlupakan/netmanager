import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuControlService } from "@/modules/olt";

const onuControl = new OnuControlService();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const result = await onuControl.disableOnu(
      id,
      session.user.tenantId,
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ disabled: false, error: result.error });
    }
    return apiSuccess({ disabled: true });
  } catch (error) {
    logger.error("Error disabling ONU:", error);
    const msg = error instanceof Error ? error.message : "Gagal disable ONU";
    return ApiErrors.internalError(msg);
  }
}
