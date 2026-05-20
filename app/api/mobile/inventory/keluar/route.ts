import { createHandler } from "@/lib/api";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  executeMobileInventoryWithIdempotency,
} from "../route-utils";

const service = getMobileInventoryService();

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  try {
    if (!hasMobilePermission(ctx.permissions, "m_barang_keluar:create")) {
      return apiError("Akses inventory keluar ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const body = await req.json();

    return executeMobileInventoryWithIdempotency({
      request: req,
      scope: "inventory:keluar",
      userId: ctx.session!.user.id,
      body,
      handler: () =>
        service.createBarangKeluar({
          actorId: ctx.session!.user.id,
          tenantId: ctx.session!.user.tenantId!,
          ...body,
        }),
    });
  } catch (error) {
    return createMobileInventoryErrorResponse(error);
  }
});
