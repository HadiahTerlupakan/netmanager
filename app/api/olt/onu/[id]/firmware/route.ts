import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { FirmwareUpgradeService } from "@/modules/olt";

const firmwareService = new FirmwareUpgradeService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_devices:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const body = await req.json();
    const firmwareFile = body.firmwareFile;

    if (!firmwareFile || typeof firmwareFile !== "string") {
      return ApiErrors.badRequest("firmwareFile wajib diisi");
    }

    const result = await firmwareService.upgradeOnuFirmware(
      id,
      firmwareFile,
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ upgraded: false, error: result.error });
    }
    return apiSuccess({ upgraded: true });
  } catch (error) {
    logger.error("Error firmware upgrade:", error);
    const msg =
      error instanceof Error ? error.message : "Firmware upgrade gagal";
    return ApiErrors.internalError(msg);
  }
}
