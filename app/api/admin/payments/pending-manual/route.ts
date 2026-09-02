import { logger } from "@/lib/logger";
import { hasCapability } from "@/lib/permission-aliases";
import { NextResponse } from "next/server";
import { getUserPermissions, isSuperAdminUser } from "@/lib/auth";
import { ensureAdminAccess } from "@/lib/server-auth";
import { ManualPaymentAdminRouteService } from "@/modules/finance";

type AdminSessionUser = Awaited<ReturnType<typeof ensureAdminAccess>> & {
  id: string;
  siteId?: string | null;
  primarySiteId?: string | null;
};

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

export async function GET(request: Request) {
  try {
    const user = (await ensureAdminAccess()) as AdminSessionUser;
    const permissions = await getUserPermissions(user.id);
    const isSuperAdmin = isSuperAdminUser(user);
    if (!isSuperAdmin && !hasCapability(permissions, "manual_payments:read")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak. Anda memerlukan permission: manual_payments:read",
        },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(request.url);
    const userSiteId = user.primarySiteId ?? user.siteId ?? null;
    const isSiteOnly =
      !isSuperAdmin && permissions.includes("manual_payments:site_only");
    const data = await manualPaymentAdminRouteService.getPendingManualPayments({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      siteId: isSiteOnly ? userSiteId : searchParams.get("siteId"),
      status: searchParams.get("status"),
      isSiteOnly,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const error = e as Error;
    logger.error("Error fetching pending manual payments:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
