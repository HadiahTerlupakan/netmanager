import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  OltOnuService,
  OnuMonitoringService,
  onuListQuerySchema,
} from "@/modules/olt";

const onuService = new OltOnuService();
const monitoringService = new OnuMonitoringService();

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
      slotFrame: searchParams.get("slotFrame") ?? undefined,
      slot: searchParams.get("slot") ?? undefined,
      ponPort: searchParams.get("ponPort") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    // Auto-refresh: poll PON port secara real-time HANYA saat user filter
    // sampai level PON port (oltId + slotFrame + slot + ponPort). Pilih OLT
    // atau Card saja tidak trigger poll agar UI tetap responsif. Search
    // global skip poll karena terlalu mahal lintas OLT.
    const isPonScopeSelected =
      query.oltId !== undefined &&
      query.slotFrame !== undefined &&
      query.slot !== undefined &&
      query.ponPort !== undefined;

    if (isPonScopeSelected && !query.search) {
      try {
        await monitoringService.pollOnusByPon(
          query.oltId!,
          session.user.tenantId,
          query.slot!,
          query.ponPort!,
        );
      } catch (error) {
        logger.warn(
          `[ONU List] Real-time poll failed for ${query.oltId}/PON${query.ponPort}, falling back to DB:`,
          error,
        );
      }
    }

    const result = await onuService.listOnus({
      tenantId: session.user.tenantId,
      ...query,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiErrors.badRequest("Query tidak valid");
    }
    logger.error("Error fetching ONUs:", error);
    const msg =
      error instanceof Error ? error.message : "Gagal mengambil data ONU";
    return ApiErrors.internalError(msg);
  }
}
