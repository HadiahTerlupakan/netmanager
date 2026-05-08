import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { AdminSalesRouteService } from "@/modules/marketing";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { isSuperAdmin } from "@/lib/auth";

const adminSalesRouteService = new AdminSalesRouteService();

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;
  if (!(await hasPermission("sales_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat sales dashboard",
    );
  }

  // Enforce site restriction for non-super-admin users
  const user = session.user as {
    id: string;
    siteIds?: string[];
    isSuperAdmin?: boolean;
  };
  const allowedSiteIds =
    !isSuperAdmin(user) && user.siteIds && user.siteIds.length > 0
      ? user.siteIds
      : undefined;

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") || "month") as
    | "day"
    | "week"
    | "month"
    | "custom"
    | "all";
  try {
    const result = await adminSalesRouteService.getSalesDashboard({
      period,
      siteId: searchParams.get("siteId"),
      customStart: searchParams.get("startDate"),
      customEnd: searchParams.get("endDate"),
      allowedSiteIds,
    });
    return apiSuccess(result);
  } catch (error: unknown) {
    logger.error("Error fetching sales dashboard:", error);
    return ApiErrors.internalError("Gagal mengambil data sales dashboard");
  }
}
