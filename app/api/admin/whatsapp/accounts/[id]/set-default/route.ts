import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import { WhatsAppAccountService } from "@/modules/notification";

const service = new WhatsAppAccountService();

/**
 * POST /api/admin/whatsapp/accounts/[id]/set-default
 * Set account as default
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("settings:write", session))) {
      return ApiErrors.forbidden();
    }

    const result = await service.setDefault(id, session.tenantId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Akun berhasil diset sebagai default",
    });
  } catch (error) {
    console.error(
      "[API] POST /api/admin/whatsapp/accounts/[id]/set-default error:",
      error,
    );
    return ApiErrors.internalError();
  }
}
