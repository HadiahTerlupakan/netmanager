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

    const result = await radiusSyncService.syncAllActiveCustomers(tenantId);

    return apiSuccess(
      {
        stats: {
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          total: result.created + result.updated + result.deleted,
        },
      },
      { message: "Sinkronisasi RADIUS selesai" },
    );
  },
);
