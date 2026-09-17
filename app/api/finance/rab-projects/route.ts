import { FinanceService } from "@/modules/finance";
import { rabProjectCreateSchema } from "@/lib/validations/rab-project";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET: List RAB Projects
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess = isSuper || (await hasPermission("expense:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read",
    );
  }

  const { searchParams } = req.nextUrl;
  const params = {
    siteId: searchParams.get("siteId"),
    status: searchParams.get("status"),
  };

  const financeService = new FinanceService();
  const projects = await financeService.getRabProjects(params);

  return apiSuccess(projects);
});

// POST: Create RAB Project
export const POST = createHandler(
  {
    auth: true,
    schema: rabProjectCreateSchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper || (await hasPermission("expense:create"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:create",
      );
    }

    const financeService = new FinanceService();
    try {
      const project = await financeService.createRabProject(
        ctx.validated as Parameters<typeof financeService.createRabProject>[0],
        user.id,
      );
      return apiSuccess(project, { status: 201 });
    } catch (error: unknown) {
      return ApiErrors.badRequest(
        error instanceof Error ? error.message : "Gagal membuat proyek RAB",
      );
    }
  },
);
