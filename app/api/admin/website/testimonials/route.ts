import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, testimonialSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/testimonials - List all testimonials (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getTestimonials();
  return apiSuccess(data);
});

/**
 * POST /api/admin/website/testimonials - Create a new testimonial (super admin only)
 */
export const POST = createHandler(
  { auth: true, schema: testimonialSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.createTestimonial(ctx.validated);
    return apiSuccess(result, { status: 201 });
  },
);
