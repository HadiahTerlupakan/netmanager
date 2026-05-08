import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraWithdrawService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const withdrawService = getMitraWithdrawService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !(await hasPermission("withdrawals:update", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Validate scope before processing
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "withdrawals",
  );
  if (isRestricted) {
    const withdrawalResult = await withdrawService.getWithdrawRequests({
      page: 1,
      limit: 1,
      allowedSiteIds: siteIds,
    });

    if (!withdrawalResult.success) {
      return NextResponse.json(
        { success: false, error: "Gagal memvalidasi akses" },
        { status: 500 },
      );
    }

    // Check if this specific withdrawal is in user's scope by fetching it
    const allWithdrawals = await withdrawService.getWithdrawRequests({
      page: 1,
      limit: 1000,
      allowedSiteIds: siteIds,
    });

    if (allWithdrawals.success) {
      const hasAccess = allWithdrawals.data?.requests.some(
        (w: { id: string }) => w.id === id,
      );
      if (!hasAccess) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Anda tidak dapat memproses withdrawal untuk mitra di luar scope Anda",
          },
          { status: 403 },
        );
      }
    }
  }

  try {
    let result;

    switch (action) {
      case "approve":
        result = await withdrawService.approveWithdraw(id, user.id!);
        break;
      case "reject": {
        const body = await request.json();
        result = await withdrawService.rejectWithdraw(
          id,
          body.reason || "Ditolak oleh admin",
          user.id!,
        );
        break;
      }
      case "complete":
        result = await withdrawService.completeWithdraw(id, user.id!);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 },
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
