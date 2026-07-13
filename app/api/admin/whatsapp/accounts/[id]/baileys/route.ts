import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppAccountService } from "@/modules/notification";
import {
  getBaileysSession,
  startBaileysSession,
  stopBaileysSession,
} from "@/modules/notification/api";

const service = new WhatsAppAccountService();

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

    const info = await getBaileysSession(id);
    return NextResponse.json({ success: true, data: info });
  } catch (error) {
    console.error("[API] GET baileys status error:", error);
    return ApiErrors.internalError();
  }
}

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

    let info;
    if (action === "stop") {
      await stopBaileysSession(id);
      info = await getBaileysSession(id);
    } else if (action === "restart") {
      // Force re-pair: wipe auth + new QR
      info = await startBaileysSession(id, { forcePairing: true });
    } else {
      const current = await getBaileysSession(id);
      if (
        current.status === "needs_reauth" ||
        current.status === "error" ||
        current.status === "disconnected"
      ) {
        // Explicit Start after logout must clear credentials and emit QR
        info = await startBaileysSession(id, { forcePairing: true });
      } else if (current.status === "connected") {
        info = current;
      } else {
        info = await startBaileysSession(id);
      }
    }

    console.info(`[API] Baileys ${action} account=${id} status=${info.status}`);
    return NextResponse.json({ success: true, data: info });
  } catch (error) {
    console.error("[API] POST baileys action error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menjalankan aksi Baileys",
      },
      { status: 500 },
    );
  }
}
