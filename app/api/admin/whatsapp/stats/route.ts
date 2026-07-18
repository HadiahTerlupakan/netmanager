import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import {
  WhatsAppSenderService,
  WhatsAppAccountService,
} from "@/modules/notification";

const service = new WhatsAppSenderService();
const accountService = new WhatsAppAccountService();

/**
 * GET /api/admin/whatsapp/stats
 * Statistik pengiriman WA.
 * - Tanpa accountId → stats global per tenant
 * - Dengan accountId → stats per akun (validasi ownership)
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
    const accountId = searchParams.get("accountId") || undefined;
    const startDateRaw = searchParams.get("startDate");
    const endDateRaw = searchParams.get("endDate");
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    if (accountId) {
      const account = await accountService.findById(
        accountId,
        session.tenantId,
      );
      if (!account) {
        return NextResponse.json(
          { success: false, error: "Akun tidak ditemukan" },
          { status: 404 },
        );
      }
    }

    const stats = await service.getGlobalStats({
      tenantId: session.tenantId,
      accountId,
      startDate:
        startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
      endDate:
        endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/stats error:", error);
    return ApiErrors.internalError();
  }
}
