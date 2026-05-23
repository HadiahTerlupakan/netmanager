import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { FirmwareUpgradeService, firmwareUpgradeSchema } from "@/modules/olt";

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
    const validated = firmwareUpgradeSchema.parse(body);

    const result = await firmwareService.upgradeOnuFirmware(
      id,
      session.user.tenantId,
      validated.firmwareFile,
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ upgraded: false, error: result.error });
    }
    return apiSuccess({ upgraded: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error firmware upgrade:", error);
    const msg =
      error instanceof Error ? error.message : "Firmware upgrade gagal";
    return ApiErrors.internalError(msg);
  }
}
