import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerNotificationService } from "@/modules/pelanggan";

const service = getCustomerNotificationService();

const DEFAULT_LIMIT = 10;
/** Batas atas: `limit` datang dari klien dan menentukan ukuran query. */
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const limit = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

/**
 * GET /api/customer/notifications
 * Get customer notifications including ticket replies
 */
export async function GET(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { session } = auth;
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

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
