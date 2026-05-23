import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { OnuDiscoveryService, searchOnuSchema } from "@/modules/olt";

const discoveryService = new OnuDiscoveryService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized("Session tidak valid");
    if (!(await hasPermission("olt_onu:read"))) {
      return ApiErrors.forbidden("Anda tidak memiliki akses");
    }

    const { searchParams } = new URL(req.url);
    const query = searchOnuSchema.parse({
      sn: searchParams.get("sn") ?? "",
      oltId: searchParams.get("oltId") ?? undefined,
    });

    if (!query.oltId) {
      return ApiErrors.badRequest("oltId wajib diisi untuk pencarian SN");
    }

    const result = await discoveryService.searchBySerialNumber(
      query.oltId,
      session.user.tenantId,
      query.sn,
    );

    if (!result.success) {
      return apiSuccess({ found: false, error: result.error });
    }

    return apiSuccess({ found: !!result.data, onu: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Data tidak valid");
    }
    logger.error("Error searching ONU:", error);
    const msg = error instanceof Error ? error.message : "Gagal mencari ONU";
    return ApiErrors.internalError(msg);
  }
}
