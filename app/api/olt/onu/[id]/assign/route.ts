import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltProvisioningService, assignOnuSchema } from "@/modules/olt";

const provisioningService = new OltProvisioningService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:update"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { id } = await params;
    const body = await req.json();
    const validated = assignOnuSchema.parse(body);

    const result = await provisioningService.assignOnuToPelanggan(
      id,
      session.user.tenantId,
      validated.pelangganId,
      session.user.id,
    );

    if (!result.success) {
      return apiSuccess({ assigned: false, error: result.error });
    }

    return apiSuccess(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error assigning ONU:", error);
    const msg = error instanceof Error ? error.message : "Gagal assign ONU";
    return ApiErrors.internalError(msg);
  }
}
