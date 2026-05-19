import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppSenderService } from "@/modules/notification";

const service = new WhatsAppSenderService();

/**
 * GET /api/admin/whatsapp/messages
 * Get WhatsApp message history
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
    const limit = parseInt(searchParams.get("limit") || "50");

    const messages = await service.getMessages(session.tenantId, limit);

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/messages error:", error);
    return ApiErrors.internalError();
  }
}
