import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltOnuService } from "@/modules/olt";

const onuService = new OltOnuService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read")))
      return ApiErrors.forbidden("Anda tidak memiliki akses");

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hours = Number(searchParams.get("hours") ?? 24);

    const history = await onuService.getPowerHistory(id, hours);
    return apiSuccess(history);
  } catch (error) {
    logger.error("Error fetching power history:", error);
    return ApiErrors.internalError("Gagal mengambil data");
  }
}
