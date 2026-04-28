import { NextResponse } from "next/server";
import * as z from "zod";

import { ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import type { OvertimeStatusValue } from "@/modules/overtime";
import { OvertimeRouteService } from "@/modules/overtime";
import { lemburFilterSchema } from "@/lib/validations/lembur";

const overtimeRouteService = new OvertimeRouteService();

/**
 * GET /api/admin/lembur
 * List overtime requests with pagination and filters
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("lembur:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parseResult = lemburFilterSchema.safeParse(queryParams);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Parameter tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const result = await overtimeRouteService.getAdminList({
    session: ctx.session as never,
    page: parseResult.data.page,
    limit: parseResult.data.limit,
    status: parseResult.data.status as OvertimeStatusValue | undefined,
    holidayType: parseResult.data.holidayType,
    siteId: parseResult.data.siteId,
    departmentId: parseResult.data.departmentId,
    startDate: parseResult.data.startDate,
    endDate: parseResult.data.endDate,
  });

  return NextResponse.json({
    success: true,
    data: result.data,
    summary: result.summary,
    pagination: result.pagination,
  });
});
