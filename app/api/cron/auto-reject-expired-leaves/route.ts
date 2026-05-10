import { NextRequest, NextResponse } from "next/server";
import { autoRejectExpiredLeaves } from "@/modules/attendance";

/**
 * Cron endpoint untuk auto-reject leave request yang sudah melewati deadline.
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

    // Run auto-reject
    const result = await autoRejectExpiredLeaves();

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
