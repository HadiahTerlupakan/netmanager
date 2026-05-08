import { logger } from "@/lib/logger";
import { ensureAdminAccess } from "@/lib/server-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  ManualPaymentAdminRouteService,
  isRouteServiceError,
} from "@/modules/finance";
import { checkSiteRestriction } from "@/modules/roles";

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

export async function POST(request: NextRequest) {
  try {
    const session = await ensureAdminAccess();
    const body = await request.json();
    const { paymentId, action, notes } = body;
    if (!paymentId || !action) {
      return NextResponse.json(
        { success: false, error: "Bad Request" },
        { status: 400 },
      );
    }

    const { isRestricted, siteIds } = checkSiteRestriction(
      session as never,
      "finance",
    );
    const allowedSiteIds = isRestricted ? siteIds : undefined;

    const result = await manualPaymentAdminRouteService.verifyManualPayment({
      paymentId,
      action,
      notes,
      allowedSiteIds,
    });
    return NextResponse.json(result);
  } catch (e) {
    const error = e as Error;
    logger.error("Error verifying manual payment:", error);
    if (isRouteServiceError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
