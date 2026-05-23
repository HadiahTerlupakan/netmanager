import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltProvisioningService, registerOnuSchema } from "@/modules/olt";

const provisioningService = new OltProvisioningService();

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk register ONU",
      );
    }

    const body = await req.json();
    const validated = registerOnuSchema.parse(body);

    const result = await provisioningService.registerOnu(
      validated.oltId,
      session.user.tenantId,
      {
        serialNumber: validated.serialNumber,
        ponPort: validated.ponPort,
        onuIndex: validated.onuIndex,
        bandwidthProfile: validated.bandwidthProfile,
        vlanId: validated.vlanId,
      },
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ registered: false, error: result.error });
    }

    return apiSuccess(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error registering ONU:", error);
    const msg = error instanceof Error ? error.message : "Gagal register ONU";
    return ApiErrors.internalError(msg);
  }
}
