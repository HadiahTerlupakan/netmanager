import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerNotificationService } from "@/modules/pelanggan";

const service = getCustomerNotificationService();

/**
 * GET /api/customer/notifications
 * Get customer notifications including ticket replies
 */
export async function GET(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { session } = auth;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");

  try {
    const result = await service.getNotifications(session.id, limit);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("[Customer Notifications GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil notifikasi" },
      { status: 500 },
    );
  }
}
