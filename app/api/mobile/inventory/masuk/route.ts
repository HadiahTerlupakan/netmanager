import { createHandler } from "@/lib/api";
import { hasMobilePermission } from "@/lib/mobile-auth";
import { getMobileInventoryService } from "@/modules/inventory";
import {
  createMobileInventoryErrorResponse,
  executeMobileInventoryWithIdempotency,
  MOBILE_INVENTORY_MESSAGES,
  readMobileInventoryBody,
  rejectMobileInventoryAccess,
} from "../route-utils";

const service = getMobileInventoryService();

/** POST /api/mobile/inventory/masuk — catat barang masuk dari aplikasi mobile. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  try {
    if (!hasMobilePermission(ctx.permissions, "m_barang_masuk:create")) {
      return rejectMobileInventoryAccess(
        MOBILE_INVENTORY_MESSAGES.noMasukAccess,
      );
    }

    const parsed = await readMobileInventoryBody(req);
    if (parsed.ok === false) return parsed.response;
    const { body } = parsed;

    return await executeMobileInventoryWithIdempotency({
      request: req,
      scope: "inventory:masuk",
      userId: ctx.session!.user.id,
      body,
      // Identitas dari sesi ditulis terakhir: badan permintaan tidak boleh
      // menimpa actorId/tenantId (dulu bisa, karena `...body` disebar paling akhir).
      handler: () =>
        service.createBarangMasuk({
          ...body,
          actorId: ctx.session!.user.id,
          tenantId: ctx.session!.user.tenantId!,
        } as Parameters<typeof service.createBarangMasuk>[0]),
    });
  } catch (error) {
    return createMobileInventoryErrorResponse(error, "simpan");
  }
});
