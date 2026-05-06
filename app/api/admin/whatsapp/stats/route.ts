import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppSenderService } from "@/modules/notification";

const service = new WhatsAppSenderService();

/**
 * GET /api/admin/whatsapp/stats
 * Get WhatsApp usage statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("settings:read", session))) {
      return ApiErrors.forbidden();
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          error: "accountId wajib diisi",
        },
        { status: 400 },
      );
    }

    const stats = await service.getAccountStats(
      accountId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/stats error:", error);
    return ApiErrors.internalError();
  }
}
