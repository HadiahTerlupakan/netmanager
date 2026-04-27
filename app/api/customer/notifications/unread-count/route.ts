import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerNotificationService } from "@/modules/pelanggan";

/**
 * Get unread notification count for the authenticated customer.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  try {
    const customerNotificationService = getCustomerNotificationService();
    const unreadCount = await customerNotificationService.getUnreadCount(
      auth.session.id,
    );

    return NextResponse.json({
      success: true,
      count: unreadCount,
    });
  } catch (error) {
    console.error("[Customer Notifications Unread Count] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil jumlah notifikasi" },
      { status: 500 },
    );
  }
}
