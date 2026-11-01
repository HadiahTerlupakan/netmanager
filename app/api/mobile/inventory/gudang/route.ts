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

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  try {
    if (
      !hasAnyMobilePermission(ctx.permissions, [
        "m_barang:read",
        "m_barang_masuk:create",
        "m_barang_keluar:create",
      ])
    ) {
      return rejectMobileInventoryAccess(MOBILE_INVENTORY_MESSAGES.noAccess);
    }

    const gudangList = await service.getGudangs({
      actorId: ctx.session!.user.id,
      tenantId: ctx.session!.user.tenantId!,
    });

    return NextResponse.json({ gudangList });
  } catch (error) {
    return createMobileInventoryErrorResponse(error);
  }
});
