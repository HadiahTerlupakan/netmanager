import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { checkSiteRestriction } from "@/modules/roles";
import { SystemLogRouteService, systemLogQuerySchema } from "@/modules/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import * as z from "zod";

const systemLogRouteService = new SystemLogRouteService();

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    if (session instanceof NextResponse) return session;

    if (!(await hasPermission("system_log:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat system log",
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = systemLogQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      type: searchParams.get("type"),
      action: searchParams.get("action"),
      siteId: searchParams.get("siteId"),
      search: searchParams.get("search"),
    });

    if (!parsed.success) {
      return ApiErrors.badRequest(
        "Parameter tidak valid",
        z.flattenError(parsed.error).fieldErrors,
      );
    }

    const query = parsed.data;
    const { isRestricted, siteIds } = checkSiteRestriction(
      session,
      "system_log",
    );

    if (isRestricted && siteIds.length === 0) {
      return apiSuccess({
        logs: [],
        pagination: {
          total: 0,
          page: query.page,
          limit: query.limit,
          totalPages: 0,
        },
      });
    }

    const result = await systemLogRouteService.getLogs({
      typeKey: query.type,
      action: query.action,
      search: query.search,
      page: query.page,
      limit: query.limit,
      requestedSiteId: query.siteId,
      restrictedSiteIds: isRestricted ? siteIds : undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching system logs:", error);
    return ApiErrors.internalError("Gagal mengambil system log");
  }
}
