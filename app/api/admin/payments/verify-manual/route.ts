import { ensureAdminAccess } from "@/lib/server-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  ManualPaymentAdminRouteService,
  isRouteServiceError,
} from "@/modules/finance";

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

export async function POST(request: NextRequest) {
  try {
    await ensureAdminAccess();
    const body = await request.json();
    const { paymentId, action, notes } = body;
    if (!paymentId || !action) {
      return NextResponse.json(
        { success: false, error: "Bad Request" },
        { status: 400 },
      );
    }
    const result = await manualPaymentAdminRouteService.verifyManualPayment({
      paymentId,
      action,
      notes,
    });
    return NextResponse.json(result);
  } catch (e) {
    const error = e as Error;
    console.error("Error verifying manual payment:", error);
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
