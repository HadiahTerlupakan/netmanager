import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OltCardService } from "@/modules/olt";

const cardService = new OltCardService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
  if (!(await hasPermission("olt_cards:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses");
  }

  const { id } = await params;
  const result = await cardService.listByOlt(session.user.tenantId, id);
  if (result.success === false) {
    if (result.error.code === "OLT_NOT_FOUND") {
      return ApiErrors.notFound("OLT tidak ditemukan");
    }
    return ApiErrors.internalError(result.error.message);
  }

  return apiSuccess(result.data);
}
