import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getResellerOutletService,
  updateResellerOutletSchema,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

function mapOutletError(error: Error) {
  if (error.message.includes("tidak ditemukan")) {
    return ApiErrors.notFound("Outlet reseller");
  }
  if (
    error.message.includes("tidak aktif") ||
    error.message.includes("tidak sesuai")
  ) {
    return ApiErrors.badRequest(error.message);
  }
  return null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const outlet = await getResellerOutletService().getOutletById(
      getTenantId(ctx),
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
    try {
      const outlet = await getResellerOutletService().updateOutlet(
        getTenantId(ctx),
        ctx.params.id,
        ctx.params.outletId,
        ctx.validated,
      );
      return apiSuccess(outlet);
    } catch (error) {
      if (error instanceof Error) {
        const response = mapOutletError(error);
        if (response) return response;
      }
      throw error;
    }
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["reseller:delete"], feature: "reseller" },
  async (_req, ctx) => {
    try {
      await getResellerOutletService().deleteOutlet(
        getTenantId(ctx),
        ctx.params.id,
        ctx.params.outletId,
      );
      return apiSuccess({ message: "Outlet reseller berhasil dihapus" });
    } catch (error) {
      if (error instanceof Error) {
        const response = mapOutletError(error);
        if (response) return response;
      }
      throw error;
    }
  },
);
