import { NextResponse, NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { checkSiteRestriction } from "@/modules/roles";
import { SystemLogRouteService } from "@/modules/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const { isRestricted, siteIds } = checkSiteRestriction(
      session,
      "system_log",
    );
    if (isRestricted && siteIds.length === 0) {
      return apiSuccess({
        logs: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      });
    }
    const result = await systemLogRouteService.getLogs({
      typeKey: searchParams.get("type"),
      action: searchParams.get("action"),
      search: searchParams.get("search"),
      page,
      limit,
      requestedSiteId: searchParams.get("siteId"),
      restrictedSiteIds: isRestricted ? siteIds : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    console.error("Error fetching system logs:", error);
    return ApiErrors.internalError("Gagal mengambil system log");
  }
}
