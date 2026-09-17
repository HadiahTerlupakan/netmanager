import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService, isRouteServiceError } from "@/modules/finance";
import { rabProjectUpdateSchema } from "@/lib/validations/rab-project";

export const dynamic = "force-dynamic";

const rabProjectRouteService = new RabProjectRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const isSuper = isSuperAdmin(user);
  const hasAccess = isSuper || (await hasPermission("expense:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read",
    );
  }

  try {
    const project = await rabProjectRouteService.getProjectDetail(id);
    return apiSuccess(project);
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

export const PATCH = createHandler(
  {
    auth: true,
    schema: rabProjectUpdateSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess = isSuper || (await hasPermission("expense:update"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:update",
      );
    }

    try {
      const project = await rabProjectRouteService.updateProject(
        id,
        ctx.validated,
      );
      return apiSuccess(project);
    } catch (error) {
      if (isRouteServiceError(error) && error.status === 404) {
        return ApiErrors.notFound(error.message);
      }

      if (isRouteServiceError(error) && error.status === 400) {
        return ApiErrors.badRequest(error.message);
      }

      throw error;
    }
  },
);

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const isSuper = isSuperAdmin(user);
  const hasAccess = isSuper || (await hasPermission("expense:delete"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:delete",
    );
  }

  try {
    await rabProjectRouteService.deleteDraftProject(id);
    return apiSuccess({ success: true });
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }

    if (isRouteServiceError(error) && error.status === 400) {
      return ApiErrors.badRequest(error.message);
    }

    throw error;
  }
});
