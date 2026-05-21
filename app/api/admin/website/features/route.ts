import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, featureSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/features - List all features (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getFeatures();
  return apiSuccess(data);
});

/**
 * POST /api/admin/website/features - Create a new feature (super admin only)
 */
export const POST = createHandler(
  { auth: true, schema: featureSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.createFeature(ctx.validated);
    return apiSuccess(result, { status: 201 });
  },
);
