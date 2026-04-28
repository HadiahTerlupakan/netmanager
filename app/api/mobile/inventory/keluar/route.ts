import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileInventoryService,
  MobileInventoryError,
} from "@/modules/inventory";

const service = getMobileInventoryService();

export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) return authResult;

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
    if (error instanceof MobileInventoryError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: error.status,
      });
    }

    logger.error("Mobile Barang Keluar Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
