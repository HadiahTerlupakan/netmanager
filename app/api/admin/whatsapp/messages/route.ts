import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppSenderService } from "@/modules/notification";

const service = new WhatsAppSenderService();
const VALID_STATUSES = new Set([
  "pending",
  "sent",
  "failed",
  "delivered",
  "read",
]);

/**
 * GET /api/admin/whatsapp/messages
 * Riwayat pesan WA — filter status/date/account/phone + pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:read", session))) {
      return ApiErrors.forbidden();
    }

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status") || undefined;
    const status =
      statusRaw && VALID_STATUSES.has(statusRaw)
        ? (statusRaw as "pending" | "sent" | "failed" | "delivered" | "read")
        : undefined;

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1,
    );
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50),
    );

    const startDateRaw = searchParams.get("startDate");
    const endDateRaw = searchParams.get("endDate");
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    const result = await service.getMessagesFiltered({
      tenantId: session.tenantId,
      status,
      accountId: searchParams.get("accountId") || undefined,
      phone: searchParams.get("phone") || undefined,
      startDate:
        startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
      endDate:
        endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/messages error:", error);
    return ApiErrors.internalError();
  }
}
