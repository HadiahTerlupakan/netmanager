import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api";
import {
  WhatsAppAccountService,
  type CreateWhatsAppAccountDTO,
  CreateWhatsAppAccountSchema,
} from "@/modules/notification";

const service = new WhatsAppAccountService();

/**
 * GET /api/admin/whatsapp/accounts
 * List all WhatsApp accounts
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

    const accounts = await service.findAll(session.tenantId);

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("[API] GET /api/admin/whatsapp/accounts error:", error);
    return ApiErrors.internalError();
  }
}

/**
 * POST /api/admin/whatsapp/accounts
 * Create new WhatsApp account
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return ApiErrors.unauthorized();
    }

    if (!(await hasPermission("whatsapp:create", session))) {
      return ApiErrors.forbidden();
    }

    const body = await req.json();

    // Validate input
    const validation = CreateWhatsAppAccountSchema.safeParse(body);
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

    const data: CreateWhatsAppAccountDTO = validation.data;

    // Create account
    const result = await service.create({
      ...data,
      tenantId: session.tenantId,
    });

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
    console.error("[API] POST /api/admin/whatsapp/accounts error:", error);
    return ApiErrors.internalError();
  }
}
