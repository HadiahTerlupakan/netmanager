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

export async function GET(req: NextRequest) {
  try {
    const authState = await requireMobileInventoryAuth(req);
    if ("response" in authState) return authState.response;
    const authResult = authState.auth;

    const permissions = authResult.permissions as string[] | undefined;
    if (
      !hasAnyMobilePermission(permissions, [
        "m_barang:read",
        "m_barang_masuk:create",
        "m_barang_keluar:create",
      ])
    ) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const gudangList = await service.getGudangs({
      actorId: authResult.id as string,
      tenantId: authResult.tenantId as string,
    });

    return NextResponse.json({ gudangList });
  } catch (error) {
    logger.error("Error fetching gudangs (mobile):", error as Error);
    return createMobileInventoryErrorResponse(error);
  }
}
