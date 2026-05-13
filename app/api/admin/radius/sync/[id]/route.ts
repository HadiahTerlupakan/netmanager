import { RadiusSyncService } from "@/modules/network";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

export const POST = createHandler(
  { auth: true, permissions: ["radius:update"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const id = (ctx.params?.id || "").trim();
    if (!id) {
      return ApiErrors.badRequest("ID pelanggan tidak valid");
    }

    const belongsToTenant =
      await radiusSyncService.ensurePelangganIdBelongsToTenant(id, tenantId);
    if (!belongsToTenant) {
      return ApiErrors.notFound("Pelanggan");
    }

    await radiusSyncService.syncSingleCustomer(id);
    const verification = await radiusSyncService.verifyCustomerSync(id);

    return apiSuccess(verification, {
      message: "Customer berhasil disinkronisasi ke RADIUS",
    });
  },
);
