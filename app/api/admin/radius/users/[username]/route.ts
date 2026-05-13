import { RadiusSyncService } from "@/modules/network";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

export const DELETE = createHandler(
  { auth: true, permissions: ["radius:delete"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const username = (ctx.params?.username || "").trim();
    if (!username) {
      return ApiErrors.badRequest("Username tidak valid");
    }

    const result = await radiusSyncService.forceRemoveRadiusUser(
      username,
      tenantId,
    );

    return apiSuccess(result, {
      message: `User ${username} berhasil dihapus dari RADIUS`,
    });
  },
);
