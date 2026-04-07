import { NextResponse } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  MikroTikRouterService,
  RouterAccessDeniedError,
  RouterNotFoundError,
} from "@/modules/network";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:update"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { id } = ctx.params;
  const user = ctx.session!.user;
  const routerService = new MikroTikRouterService();
  const restrictedToOwnSite =
    (await hasPermission("mikrotik:site_only")) && user.role !== "SUPER_ADMIN";

  try {
    const result = await routerService.generateApiUser({
      id,
      userId: user.id,
      tenantId: user.tenantId,
      restrictedToOwnSite,
    });

    if (!result.success) {
      console.error(`[Generate API User] Failed: ${result.logs.join(", ")}`);
      return NextResponse.json(
        {
          error: "Gagal membuat API user",
          logs: result.logs,
        },
        { status: 500 },
      );
    }

    return apiSuccess({
      success: true,
      username: result.username,
      logs: result.logs,
    });
  } catch (error: unknown) {
    if (error instanceof RouterNotFoundError) {
      return ApiErrors.notFound("Router tidak ditemukan");
    }

    if (error instanceof RouterAccessDeniedError) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    throw error;
  }
});
