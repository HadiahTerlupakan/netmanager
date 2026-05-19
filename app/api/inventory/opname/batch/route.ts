import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getUserPermissions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { inventoryOpnameRouteService } from "@/modules/inventory";
import type { NextResponse } from "next/server";

/**
 * POST /api/inventory/opname/batch
 *
 * Catat banyak item stock opname dalam satu transaksi atomic.
 * Body: `{ gudangId: string, items: OpnameItemInput[] }`.
 */
export const POST = createHandler(
  { auth: true },
  async (req, ctx): Promise<NextResponse> => {
    const startTime = Date.now();
    const user = ctx.session!.user;

    if (!(await hasPermission("opname:create"))) {
      return ApiErrors.forbidden();
    }

    const body = await req.json().catch((): null => null);
    if (!body) return ApiErrors.badRequest("Body request tidak valid");

    const result = await inventoryOpnameRouteService.createOpnameBatch({
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

    if (result.success === false) {
      logger.error(
        "Error creating stock opname batch",
        new Error(result.error),
        {
          path: "/api/inventory/opname/batch",
          method: "POST",
        },
      );

      if (result.status === 404) return ApiErrors.notFound(result.error);
      if (result.status === 403) return ApiErrors.forbidden(result.error);
      if (result.status === 400) {
        return ApiErrors.badRequest(result.error, result.details);
      }
      return ApiErrors.internalError(result.error);
    }

    logger.apiRequest(
      "POST",
      "/api/inventory/opname/batch",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        totalItems: result.data.totalItems,
      },
    );

    return apiSuccess(
      {
        message: `Stock opname berhasil dicatat untuk ${result.data.totalItems} item`,
        totalItems: result.data.totalItems,
        results: result.data.results,
      },
      { status: 201 },
    );
  },
);
