import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { AdminTenantRouteService } from "@/modules/admin";

const tenantService = new AdminTenantRouteService();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isSuperAdmin) {
      return apiError("Forbidden", ErrorCodes.UNAUTHORIZED, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const tenants = await tenantService.getTenants({ activeOnly });
    return NextResponse.json({ success: true, data: tenants });
  } catch (error) {
    logger.error("[TENANT_GET]", error);
    return apiError("Failed to fetch tenants", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isSuperAdmin) {
      return apiError("Forbidden", ErrorCodes.UNAUTHORIZED, { status: 403 });
    }

    const body = await request.json();
    const { name, domain, isActive } = body;
    if (!name) {
      return apiError("Name is required", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const tenant = await tenantService.createTenant({ name, domain, isActive });
    return NextResponse.json({
      success: true,
      data: tenant,
      message: `Tenant ${tenant.name} berhasil dibuat dengan data default.`,
    });
  } catch (error) {
    logger.error("[TENANT_POST]", error);
    return apiError("Failed to create tenant", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
