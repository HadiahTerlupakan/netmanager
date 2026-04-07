import { hasPermission } from "@/lib/rbac";
import { mikrotikRouterUpdateSchema } from "@/lib/validations/mikrotik";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import {
  MikroTikRouterService,
  RouterAccessDeniedError,
  RouterNotFoundError,
} from "@/modules/network";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;
  const routerService = new MikroTikRouterService();
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  try {
    const router = await routerService.getRouterById({
      id,
      tenantId: user.tenantId,
      userId: user.id,
      restrictedToOwnSite,
    });

    return apiSuccess({ router });
  } catch (error: unknown) {
    if (error instanceof RouterNotFoundError) {
      return ApiErrors.notFound("Router");
    }

    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    throw error;
  }
});

export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const body = await req.json();

  const parsed = mikrotikRouterUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const user = ctx.session!.user;
  const routerService = new MikroTikRouterService();
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  try {
    await routerService.updateRouter({
      id,
      data: parsed.data,
      userId: user.id,
      tenantId: user.tenantId,
      restrictedToOwnSite,
    });

    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof RouterNotFoundError) {
      return ApiErrors.notFound("Router");
    }

    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    return apiError(
      "Gagal mengupdate router atau IP Address sudah terpakai",
      ErrorCodes.CONFLICT,
      { status: 409 },
    );
  }
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;
  const routerService = new MikroTikRouterService();
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  try {
    await routerService.deleteRouter({
      id,
      userId: user.id,
      tenantId: user.tenantId,
      restrictedToOwnSite,
    });

    return apiSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    return apiError("Gagal menghapus router", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
});
