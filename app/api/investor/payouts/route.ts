import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getInvestorAuth } from "@/lib/auth/investor-auth";
import { getInvestorPortalPayoutService } from "@/modules/investor";

/** Mengambil daftar payout investor dari service finance. */
export async function GET(request: Request) {
  try {
    const auth = await getInvestorAuth();
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const response = await getInvestorPortalPayoutService().getPayouts(
      auth.id,
      new URL(request.url).searchParams,
    );
    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error("Get Payouts error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage.includes("Permission") ? 403 : 500;
    return NextResponse.json({ message: errorMessage }, { status });
  }
}
