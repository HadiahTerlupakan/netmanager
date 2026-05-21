import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, pricingSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * PUT /api/admin/website/pricing/[id] - Update a pricing plan (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: pricingSchema.partial() },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { id } = ctx.params;
    const result = await service.updatePricing(id, ctx.validated);
    return apiSuccess(result);
  },
);

/**
 * DELETE /api/admin/website/pricing/[id] - Delete a pricing plan (super admin only)
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  await service.deletePricing(id);
  return apiSuccess({ deleted: true });
});
