import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { getMobileRestockStatusService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  MOBILE_INVENTORY_MESSAGES,
  rejectMobileInventoryAccess,
} from "../route-utils";
import { presentRestockRequestForMobile } from "./presentRestockRequest";

const service = getMobileRestockStatusService();

/**
 * Daftar pengajuan barang untuk gudang di site pengguna, hanya untuk dilihat.
 * `?cursor=` berisi `nextCursor` halaman sebelumnya.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  try {
    if (
      !hasAnyMobilePermission(ctx.permissions, [
        "m_barang:read",
        "m_barang_masuk:read",
        "m_barang_keluar:read",
      ])
    ) {
      return rejectMobileInventoryAccess(MOBILE_INVENTORY_MESSAGES.noAccess);
    }

    const page = await service.getRequestPage({
      actorId: ctx.session!.user.id,
      tenantId: ctx.session!.user.tenantId!,
      cursor: req.nextUrl.searchParams.get("cursor"),
    });

    return NextResponse.json({
      success: true,
      data: page.items.map(presentRestockRequestForMobile),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return createMobileInventoryErrorResponse(error);
  }
});
