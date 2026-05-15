import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getInvestorAuth, InvestorAuthError } from "@/lib/auth/investor-auth";
import { getInvestorPortalDashboardService } from "@/modules/investor";

/** Mengambil ringkasan dashboard investor dari service finance. */
export async function GET() {
  try {
    const auth = await getInvestorAuth();
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const response = await getInvestorPortalDashboardService().getDashboard(
      auth.id,
      auth.tenantId,
    );
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof InvestorAuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    logger.error("[INVESTOR_DASHBOARD] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
