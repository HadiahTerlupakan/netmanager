import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, pricingSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/pricing - List all pricing plans (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getPricing();
  return apiSuccess(data);
});

/**
 * POST /api/admin/website/pricing - Create a new pricing plan (super admin only)
 */
export const POST = createHandler(
  { auth: true, schema: pricingSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.createPricing(ctx.validated);
    return apiSuccess(result, { status: 201 });
  },
);
