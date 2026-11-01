import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  MOBILE_INVENTORY_MESSAGES,
  rejectMobileInventoryAccess,
} from "../route-utils";

const service = getMobileInventoryService();

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

    const result = await service.getRiwayat({
      actorId: ctx.session!.user.id,
      tenantId: ctx.session!.user.tenantId!,
      type: req.nextUrl.searchParams.get("type"),
      cursor: req.nextUrl.searchParams.get("cursor"),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return createMobileInventoryErrorResponse(error);
  }
});
