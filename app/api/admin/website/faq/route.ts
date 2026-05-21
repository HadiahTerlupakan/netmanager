import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { LandingContentService, faqSchema } from "@/modules/website";

const service = new LandingContentService();

/**
 * GET /api/admin/website/faq - List all FAQ items (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const data = await service.getFaq();
  return apiSuccess(data);
});

/**
 * POST /api/admin/website/faq - Create a new FAQ item (super admin only)
 */
export const POST = createHandler(
  { auth: true, schema: faqSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const result = await service.createFaq(ctx.validated);
    return apiSuccess(result, { status: 201 });
  },
);
