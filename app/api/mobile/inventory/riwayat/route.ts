import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileInventoryService,
  MobileInventoryError,
} from "@/modules/inventory";

const service = getMobileInventoryService();

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) return authResult;

    if (
      !hasAnyMobilePermission(authResult.permissions as string[] | undefined, [
        "m_barang:read",
        "m_barang_masuk:read",
        "m_barang_keluar:read",
      ])
    ) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const result = await service.getRiwayat({
      actorId: authResult.userId as string,
      tenantId: authResult.tenantId as string,
      type: request.nextUrl.searchParams.get("type"),
      cursor: request.nextUrl.searchParams.get("cursor"),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof MobileInventoryError) {
      return apiError(error.message, ErrorCodes.FORBIDDEN, {
        status: error.status,
      });
    }

    logger.error("Mobile Inventory History Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
