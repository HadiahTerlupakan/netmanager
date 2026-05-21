import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, testimonialSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * PUT /api/admin/website/testimonials/[id] - Update a testimonial (super admin only)
 */
export const PUT = createHandler(
  { auth: true, schema: testimonialSchema.partial() },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { id } = ctx.params;
    const result = await service.updateTestimonial(id, ctx.validated);
    return apiSuccess(result);
  },
);

/**
 * DELETE /api/admin/website/testimonials/[id] - Delete a testimonial (super admin only)
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  await service.deleteTestimonial(id);
  return apiSuccess({ deleted: true });
});
