import { NextRequest, NextResponse } from "next/server";
import { sendLeaveReminders } from "@/modules/attendance";

/**
 * Cron endpoint untuk mengirim reminder ke approver sebelum deadline auto-reject.
 *
 * Setup di cron service (Vercel Cron, etc):
 * - Schedule: setiap 1 jam (0 * * * *)
 * - Method: GET
 * - Headers: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Send reminders
    const result = await sendLeaveReminders();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
