import { mikrotikRouterCreateSchema } from "@/lib/validations/mikrotik";
import { hasPermission } from "@/lib/rbac";
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
} from "@/modules/network";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || undefined;

  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const user = ctx.session!.user;
  const routerService = new MikroTikRouterService();
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  const result = await routerService.listRouters({
    userId: user.id,
    tenantId: user.tenantId,
    restrictedToOwnSite,
    search,
    page,
    limit,
  });

  return apiSuccess(result);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const parsed = mikrotikRouterCreateSchema.safeParse(body);
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
    const router = await routerService.createRouter({
      data: parsed.data,
      autoConfigure: body.autoConfigure,
      userId: user.id,
      tenantId: user.tenantId,
      restrictedToOwnSite,
    });

    return apiSuccess({ id: router.id }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden(error.message);
    }

    return apiError(
      "IP Address sudah terpakai atau terjadi kesalahan",
      ErrorCodes.CONFLICT,
      { status: 409 },
    );
  }
});
