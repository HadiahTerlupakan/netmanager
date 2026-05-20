import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { hasAnyMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import { createMobileInventoryErrorResponse } from "../route-utils";

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
      return apiError("Akses inventory ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
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
