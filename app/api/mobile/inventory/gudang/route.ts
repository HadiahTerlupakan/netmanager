import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  InventoryRepository,
  MobileInventoryError,
  MobileInventoryService,
} from "@/modules/inventory";

const service = new MobileInventoryService(new InventoryRepository());

export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) return authResult;

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
    if (error instanceof MobileInventoryError) {
      return apiError(error.message, ErrorCodes.FORBIDDEN, {
        status: error.status,
      });
    }

    console.error("Error fetching gudangs (mobile):", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
