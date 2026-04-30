import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  requireMobileInventoryAuth,
} from "../route-utils";

const service = getMobileInventoryService();

export async function POST(request: NextRequest) {
  try {
    const authState = await requireMobileInventoryAuth(request);
    if ("response" in authState) return authState.response;
    const authResult = authState.auth;

    if (
      !hasMobilePermission(
        authResult.permissions as string[] | undefined,
        "m_barang_keluar:create",
      )
    ) {
      return apiError("Akses inventory keluar ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const body = await request.json();
    const result = await service.createBarangKeluar({
      actorId: authResult.userId as string,
      tenantId: authResult.tenantId as string,
      ...body,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("Mobile Barang Keluar Error:", error as Error);
    return createMobileInventoryErrorResponse(error);
  }
}
