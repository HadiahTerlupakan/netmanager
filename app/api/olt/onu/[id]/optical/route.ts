import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuControlService } from "@/modules/olt";

const onuControl = new OnuControlService();

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
    const result = await onuControl.getOpticalPower(id);

    if (!result.success) {
      return apiSuccess({ rxPower: null, txPower: null, error: result.error });
    }
    return apiSuccess(result.data);
  } catch (error) {
    logger.error("Error getting optical power:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal membaca optical power";
    return ApiErrors.internalError(msg);
  }
}
