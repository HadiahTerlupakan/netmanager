import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import { createMobileInventoryErrorResponse } from "../route-utils";

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
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
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
