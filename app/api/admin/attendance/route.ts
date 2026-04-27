import * as z from "zod";
import { createHandler, apiSuccess } from "@/lib/api";
import { apiPaginatedWithSummary, ApiErrors } from "@/lib/api-response";
import { logActivitySafe } from "@/lib/logger";
import {
  attendanceBulkDeleteSchema,
  attendanceFilterSchema,
} from "@/lib/validations/attendance";
import { hasPermission } from "@/lib/rbac";
import { AdminAttendanceRouteService } from "@/modules/attendance";

const adminAttendanceRouteService = new AdminAttendanceRouteService();

function toAttendanceError(code: number, message: string) {
  if (code === 400) return ApiErrors.badRequest(message);
  if (code === 403) return ApiErrors.forbidden(message);
  return ApiErrors.badRequest(message);
}

/** Get admin attendance list or export response. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("attendance:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parseResult = attendanceFilterSchema.safeParse(queryParams);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Parameter tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const result = await adminAttendanceRouteService.getAdminAttendances(
    user,
    parseResult.data,
  );
  if (result.type === "error") {
    return toAttendanceError(result.code, result.message);
  }
  if (result.type === "response") {
    return result.response;
  }

  return apiPaginatedWithSummary(result.data, result.meta);
});

/** Delete multiple attendance records from admin route. */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("attendance:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiErrors.badRequest("Data tidak valid");
  }

  const parseResult = attendanceBulkDeleteSchema.safeParse(body);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const result = await adminAttendanceRouteService.deleteAdminAttendances(
    user,
    parseResult.data.ids,
  );
  if (!result.ok) {
    return toAttendanceError(result.code, result.message);
  }

  logActivitySafe({
    action: "DELETE",
    subject: "Attendance",
    userId: user.id,
    details: {
      ids: result.data.deletedIds,
      requestedCount: result.data.requestedCount,
      deletedCount: result.data.deletedCount,
    },
  });

  return apiSuccess(result.data);
});
