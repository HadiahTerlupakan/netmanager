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
    const gudangId = req.nextUrl.searchParams.get("gudangId");
    const mode = req.nextUrl.searchParams.get("mode") || "keluar";
    const allowedPermissions =
      mode === "masuk"
        ? ["m_barang:read", "m_barang_masuk:create"]
        : ["m_barang:read", "m_barang_keluar:create"];

    if (!hasAnyMobilePermission(ctx.permissions, allowedPermissions)) {
      return rejectMobileInventoryAccess(MOBILE_INVENTORY_MESSAGES.noAccess);
    }

    const barangList = await service.getBarang({
      actorId: ctx.session!.user.id,
      tenantId: ctx.session!.user.tenantId!,
      gudangId,
      mode,
    });

    return NextResponse.json({ barangList });
  } catch (error) {
    return createMobileInventoryErrorResponse(error);
  }
});
