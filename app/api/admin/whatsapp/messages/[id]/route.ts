import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppSenderService } from "@/modules/notification";

const service = new WhatsAppSenderService();

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/whatsapp/messages/[id]
 * Detail satu pesan WA (isi, error, response provider).
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:read", session))) {
      return ApiErrors.forbidden();
    }

    const { id } = await ctx.params;
    const message = await service.getMessageDetail(id, session.tenantId);

    if (!message) {
      return ApiErrors.notFound("Pesan tidak ditemukan");
    }

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/messages/[id] error:", error);
    return ApiErrors.internalError();
  }
}
