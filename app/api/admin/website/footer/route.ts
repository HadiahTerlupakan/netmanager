import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, footerSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/footer - Get footer section content (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getFooter();
  return apiSuccess(data);
});

/**
 * PUT /api/admin/website/footer - Upsert footer section content (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: footerSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.upsertFooter(ctx.validated);
    return apiSuccess(result);
  },
);
