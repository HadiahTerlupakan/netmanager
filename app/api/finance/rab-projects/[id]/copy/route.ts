import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService, isRouteServiceError } from "@/modules/finance";

const rabProjectRouteService = new RabProjectRouteService();

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const isSuper = isSuperAdmin(user);
  const hasAccess =
    isSuper ||
    (await hasPermission("expense:create")) ||
    (await hasPermission("mixradius_expenses:create"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create",
    );
  }

  try {
    const duplicatedProject = await rabProjectRouteService.duplicateProject(
      id,
      user.id,
    );
    return apiSuccess(duplicatedProject, { status: 201 });
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
