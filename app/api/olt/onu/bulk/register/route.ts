import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { BulkOperationService, bulkRegisterSchema } from "@/modules/olt";

const bulkService = new BulkOperationService();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:create"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const body = await req.json();
    const validated = bulkRegisterSchema.parse(body);

    const items = validated.items.map((item) => ({
      oltId: item.oltId,
      params: {
        serialNumber: item.serialNumber,
        ponPort: item.ponPort,
        onuIndex: item.onuIndex,
      },
    }));

    const result = await bulkService.bulkRegister(items, session.user.id);
    return apiSuccess(result.data);
  } catch (error) {
    logger.error("Error bulk register:", error);
    if (error instanceof Error && error.name === "ZodError")
      return ApiErrors.badRequest("Data tidak valid");
    const msg = error instanceof Error ? error.message : "Bulk register gagal";
    return ApiErrors.internalError(msg);
  }
}
