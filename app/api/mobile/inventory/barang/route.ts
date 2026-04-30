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

    const { searchParams } = new URL(req.url);
    const gudangId = searchParams.get("gudangId");
    const mode = searchParams.get("mode") || "keluar";
    const allowedPermissions =
      mode === "masuk"
        ? ["m_barang:read", "m_barang_masuk:create"]
        : ["m_barang:read", "m_barang_keluar:create"];

    if (
      !hasAnyMobilePermission(
        authResult.permissions as string[] | undefined,
        allowedPermissions,
      )
    ) {
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const barangList = await service.getBarang({
      actorId: authResult.id as string,
      tenantId: authResult.tenantId as string,
      gudangId,
      mode,
    });

    return NextResponse.json({ barangList });
  } catch (error) {
    logger.error("Error fetching barangs (mobile):", error as Error);
    return createMobileInventoryErrorResponse(error);
  }
}
