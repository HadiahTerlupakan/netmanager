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

export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) return authResult;

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
    if (error instanceof MobileInventoryError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: error.status,
      });
    }

    logger.error("Error fetching barangs (mobile):", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
