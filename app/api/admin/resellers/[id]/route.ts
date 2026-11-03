import {
  apiSuccess,
  ApiErrors,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  getResellerComplianceService,
  getResellerService,
  updateResellerSchema,
} from "@/modules/reseller";

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const reseller =
      await getResellerComplianceService().getResellerWithCompliance(
        requireSessionTenantId(ctx),
        ctx.params.id,
      );
    if (!reseller) return ApiErrors.notFound("Reseller");
    return apiSuccess(reseller);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: updateResellerSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const reseller = await getResellerService().updateReseller(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.validated,
      ctx.session?.user.id ?? null,
    );
    return apiSuccess(reseller);
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["reseller:delete"], feature: "reseller" },
  async (_req, ctx) => {
    await getResellerService().deleteReseller(
      requireSessionTenantId(ctx),
      ctx.params.id,
    );
    return apiSuccess({ message: "Reseller berhasil dihapus" });
  },
);
