import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import {
  WhatsAppAccountService,
  getBaileysSession,
  startBaileysSession,
  stopBaileysSession,
} from "@/modules/notification";

const service = new WhatsAppAccountService();

/**
 * GET /api/admin/whatsapp/accounts/[id]/baileys
 * Get Baileys session status + QR (if pending)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("whatsapp:read", session))) {
      return ApiErrors.forbidden();
    }

    const account = await service.findById(id, session.tenantId);
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Akun tidak ditemukan" },
        { status: 404 },
      );
    }
    if (account.provider !== "BAILEYS") {
      return NextResponse.json(
        { success: false, error: "Akun ini bukan provider BAILEYS" },
        { status: 400 },
      );
    }

    const info = getBaileysSession(id);
    return NextResponse.json({ success: true, data: info });
  } catch (error) {
    console.error("[API] GET baileys status error:", error);
    return ApiErrors.internalError();
  }
}

/**
 * POST /api/admin/whatsapp/accounts/[id]/baileys
 * body: { action: "start" | "stop" | "restart" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("whatsapp:update", session))) {
      return ApiErrors.forbidden();
    }

    const account = await service.findById(id, session.tenantId);
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Akun tidak ditemukan" },
        { status: 404 },
      );
    }
    if (account.provider !== "BAILEYS") {
      return NextResponse.json(
        { success: false, error: "Akun ini bukan provider BAILEYS" },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { action?: string };
    const action = body.action || "start";

    if (action === "stop") {
      await stopBaileysSession(id);
    } else if (action === "restart") {
      await stopBaileysSession(id);
      await startBaileysSession(id);
    } else {
      await startBaileysSession(id);
    }

    const info = getBaileysSession(id);
    return NextResponse.json({ success: true, data: info });
  } catch (error) {
    console.error("[API] POST baileys action error:", error);
    return ApiErrors.internalError();
  }
}
