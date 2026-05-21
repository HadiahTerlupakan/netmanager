import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, heroSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/hero - Get hero section content (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getHero();
  return apiSuccess(data);
});

/**
 * PUT /api/admin/website/hero - Upsert hero section content (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: heroSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.upsertHero(ctx.validated);
    return apiSuccess(result);
  },
);
