import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import {
  WhatsAppAccountService,
  type UpdateWhatsAppAccountDTO,
  UpdateWhatsAppAccountSchema,
} from "@/modules/notification";

const service = new WhatsAppAccountService();

/**
 * GET /api/admin/whatsapp/accounts/[id]
 * Get single WhatsApp account
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:read", session))) {
      return ApiErrors.forbidden();
    }

    const account = await service.findById(id);

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: "Akun tidak ditemukan",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/accounts/[id] error:", error);
    return ApiErrors.internalError();
  }
}

/**
 * PATCH /api/admin/whatsapp/accounts/[id]
 * Update WhatsApp account
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:update", session))) {
      return ApiErrors.forbidden();
    }

    const body = await req.json();

    // Validate input
    const validation = UpdateWhatsAppAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validasi gagal",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const data: UpdateWhatsAppAccountDTO = validation.data;

    // Update account
    const result = await service.update(id, data);

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
      data: result.data,
    });
  } catch (error) {
    console.error(
      "[API] PATCH /api/admin/whatsapp/accounts/[id] error:",
      error,
    );
    return ApiErrors.internalError();
  }
}

/**
 * DELETE /api/admin/whatsapp/accounts/[id]
 * Delete WhatsApp account
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:delete", session))) {
      return ApiErrors.forbidden();
    }

    const result = await service.delete(id);

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
    });
  } catch (error) {
    console.error(
      "[API] DELETE /api/admin/whatsapp/accounts/[id] error:",
      error,
    );
    return ApiErrors.internalError();
  }
}
