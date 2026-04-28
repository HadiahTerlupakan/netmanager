import { logger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  AdminTenantRouteService,
  tenantRouteErrorMessages,
} from "@/modules/admin";

const tenantService = new AdminTenantRouteService();

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isSuperAdmin) {
      return apiError("Forbidden", ErrorCodes.UNAUTHORIZED, { status: 403 });
    }

    const body = await req.json();
    const { name, domain, isActive } = body;
    if (!name) {
      return apiError("Name is required", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const { id } = await context.params;
    const result = await tenantService.updateTenant(id, {
      name,
      domain,
      isActive,
    });
    if ("error" in result) {
      return apiError(result.error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Tenant updated successfully",
    });
  } catch (error: unknown) {
    logger.error("[TENANT_PUT]", error);
    const message =
      error instanceof Error
        ? error.message
        : tenantRouteErrorMessages.TENANT_UPDATE_FAILED;
    return apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isSuperAdmin) {
      return apiError("Forbidden", ErrorCodes.UNAUTHORIZED, { status: 403 });
    }

    const { id } = await context.params;
    const result = await tenantService.deleteTenant(id);
    if ("error" in result) {
      return apiError(result.error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Tenant deleted successfully",
    });
  } catch (error: unknown) {
    logger.error("[TENANT_DELETE]", error);
    return apiError(
      tenantRouteErrorMessages.TENANT_DELETE_FAILED,
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
