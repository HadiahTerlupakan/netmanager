import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, featureSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * PUT /api/admin/website/features/[id] - Update a feature (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: featureSchema.partial() },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { id } = ctx.params;
    const result = await service.updateFeature(id, ctx.validated);
    return apiSuccess(result);
  },
);

/**
 * DELETE /api/admin/website/features/[id] - Delete a feature (super admin only)
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  await service.deleteFeature(id);
  return apiSuccess({ deleted: true });
});
