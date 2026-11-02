import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import {
  AdminSalesRouteService,
  resolveSalesAllowedSiteIds,
  SALES_SITE_SCOPE_RESOURCE,
} from "@/modules/marketing";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getFeatureFlagService } from "@/modules/feature-flags";

const adminSalesRouteService = new AdminSalesRouteService();

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;
  if (!(await hasPermission("sales_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat sales dashboard",
    );
  }

  // Feature flag gate (super admin bypass)
  const tenantId = session.user.tenantId;
  if (tenantId && !isSuperAdmin(session.user)) {
    const enabled = await getFeatureFlagService().isEnabled(
      tenantId,
      "marketing",
    );
    if (!enabled) {
      return ApiErrors.forbidden(
        "Modul Marketing tidak aktif untuk tenant Anda.",
      );
    }
  }

  // Dibatasi hanya bila role memegang `sales_dashboard:site_only` (persis);
  // dibatasi tanpa site = daftar kosong, bukan tanpa batas.
  const allowedSiteIds = resolveSalesAllowedSiteIds({
    user: session.user,
    permissions: await getUserPermissions(session.user.id),
    resource: SALES_SITE_SCOPE_RESOURCE.dashboard,
  });

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
