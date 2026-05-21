import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, faqSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * PUT /api/admin/website/faq/[id] - Update a FAQ item (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: faqSchema.partial() },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { id } = ctx.params;
    const result = await service.updateFaq(id, ctx.validated);
    return apiSuccess(result);
  },
);

/**
 * DELETE /api/admin/website/faq/[id] - Delete a FAQ item (super admin only)
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  await service.deleteFaq(id);
  return apiSuccess({ deleted: true });
});
