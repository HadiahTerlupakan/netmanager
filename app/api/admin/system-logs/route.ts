import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { MAIN_TENANT_ID } from "@/modules/mitra";
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
      tenantId: tenantScope(session.user),
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching system logs:", error);
    return ApiErrors.internalError("Gagal mengambil system log");
  }
}

/**
 * Log berisi data pribadi (nama, email, IP) semua tenant. Hanya super admin
 * dan tenant utama yang melihat semuanya; admin tenant lain dibatasi ke
 * tenantnya sendiri, dan tanpa tenant tidak melihat apa pun.
 */
function tenantScope(user: {
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}): string | undefined {
  if (user.isSuperAdmin || user.tenantId === MAIN_TENANT_ID) return undefined;
  return user.tenantId || NO_TENANT;
}

const NO_TENANT = "__tanpa-tenant__";
