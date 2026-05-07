import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getUserPermissions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parsePaginationParams } from "@/lib/utils/pagination";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryOpnameService,
  inventoryOpnameRouteService,
} from "@/modules/inventory";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden();
  }

  const { searchParams } = req.nextUrl;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 20,
  });

  try {
    const opnameService = getInventoryOpnameService();
    const result = await opnameService.listOpname({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: await getUserPermissions(user.id),
        siteId: user.siteId,
      },
      barangId,
      gudangId,
      page,
      limit,
    });

    logger.apiRequest(
      "GET",
      "/api/inventory/opname",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.opnameList.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching stock opname", err, {
      path: "/api/inventory/opname",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data stock opname");
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:create"))) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const routeResult = await inventoryOpnameRouteService.createOpname({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: await getUserPermissions(user.id),
      siteId: user.siteId,
    },
    body,
  });

  if ("error" in routeResult) {
    logger.error("Error creating stock opname", new Error(routeResult.error), {
      path: "/api/inventory/opname",
      method: "POST",
    });

    if (routeResult.status === 404) {
      return ApiErrors.notFound(routeResult.error);
    }

    if (routeResult.status === 403) {
      return ApiErrors.forbidden(routeResult.error);
    }

    if (routeResult.status === 400) {
      return ApiErrors.badRequest(routeResult.error);
    }

    return ApiErrors.internalError(routeResult.error);
  }

  if (!("data" in routeResult)) {
    return ApiErrors.internalError("Gagal mencatat stock opname");
  }

  const result = routeResult.data;

  logger.apiRequest(
    "POST",
    "/api/inventory/opname",
    201,
    Date.now() - startTime,
    {
      userId: user.id,
      barangId: body.barangId,
      gudangId: body.gudangId,
      stokFisik: body.stokFisik,
      stokSistem: result.previousStock,
      selisih: result.selisih,
      opnameId: result.opnameRecord.id,
    },
  );

  return apiSuccess(
    {
      message: "Stock opname berhasil dicatat",
      opname: {
        ...result.opnameRecord,
        previousStock: result.previousStock,
        newStock: result.newStock,
        selisih: result.selisih,
      },
    },
    { status: 201 },
  );
});
