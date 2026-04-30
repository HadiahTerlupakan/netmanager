import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  requireMobileInventoryAuth,
} from "../route-utils";

const service = getMobileInventoryService();

export async function GET(request: NextRequest) {
  try {
    const authState = await requireMobileInventoryAuth(request);
    if ("response" in authState) return authState.response;
    const authResult = authState.auth;

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
    logger.error("Mobile Inventory History Error:", error as Error);
    return createMobileInventoryErrorResponse(error);
  }
}
