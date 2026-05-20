import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltOnuService, onuListQuerySchema } from "@/modules/olt";

const onuService = new OltOnuService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const query = onuListQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      oltId: searchParams.get("oltId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    const result = await onuService.listOnus({
      tenantId: session.user.tenantId,
      ...query,
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching ONUs:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil data ONU";
    return ApiErrors.internalError(msg);
  }
}
