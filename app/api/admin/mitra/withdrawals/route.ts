import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraWithdrawService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const withdrawService = getMitraWithdrawService();

// List all withdraw requests (admin)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (
    !user ||
    !(await hasPermission("withdrawals:read", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "withdrawals",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const result = await withdrawService.getWithdrawRequests({
    status,
    page,
    limit,
    allowedSiteIds,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
