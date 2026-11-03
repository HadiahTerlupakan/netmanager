import {
  apiSuccess,
  ApiErrors,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  getResellerOutletService,
  updateResellerOutletSchema,
} from "@/modules/reseller";

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const outlet = await getResellerOutletService().getOutletById(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.params.outletId,
    );
    if (!outlet) return ApiErrors.notFound("Outlet reseller");
    return apiSuccess(outlet);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: updateResellerOutletSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const outlet = await getResellerOutletService().updateOutlet(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.params.outletId,
      ctx.validated,
    );
    return apiSuccess(outlet);
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["reseller:delete"], feature: "reseller" },
  async (_req, ctx) => {
    await getResellerOutletService().deleteOutlet(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.params.outletId,
    );
    return apiSuccess({ message: "Outlet reseller berhasil dihapus" });
  },
);
