import {
  apiError,
  ApiErrors,
  apiSuccess,
  createHandler,
  ErrorCodes,
} from "@/lib/api";
import { attendanceUpdateSchema } from "@/modules/attendance";
import { idSchema } from "@/lib/validations/common";
import { hasPermission } from "@/lib/rbac";
import { AdminAttendanceDetailRouteService } from "@/modules/attendance";

const service = new AdminAttendanceDetailRouteService();

function toInvalidIdResponse() {
  return apiError("ID tidak valid", ErrorCodes.VALIDATION_ERROR, {
    status: 400,
  });
}

function toAttendanceResultResponse<T>(result: {
  type: "success" | "notFound" | "badRequest";
  data?: T;
  message?: string;
}) {
  if (result.type === "notFound") {
    return apiError(
      result.message ?? "Data absensi tidak ditemukan",
      ErrorCodes.NOT_FOUND,
      { status: 404 },
    );
  }
  if (result.type === "badRequest") {
    return ApiErrors.badRequest(result.message ?? "Permintaan tidak valid");
  }
  return apiSuccess(
    result.data,
    result.message ? { message: result.message } : undefined,
  );
}

// GET /api/admin/attendance/[id]
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("attendance:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const parseResult = idSchema.safeParse(ctx.params.id);
  if (!parseResult.success) return toInvalidIdResponse();

  const result = await service.getAttendance(
    parseResult.data,
    ctx.session!.user,
  );
  return toAttendanceResultResponse(result);
});

// PATCH /api/admin/attendance/[id]
export const PATCH = createHandler(
  {
    auth: true,
    schema: attendanceUpdateSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("attendance:update"))) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    const parseResult = idSchema.safeParse(ctx.params.id);
    if (!parseResult.success) return ApiErrors.badRequest("ID tidak valid");

    const result = await service.updateAttendance(
      parseResult.data,
      ctx.session!.user,
      ctx.validated,
    );
    return toAttendanceResultResponse(result);
  },
);

// DELETE /api/admin/attendance/[id]
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("attendance:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const parseResult = idSchema.safeParse(ctx.params.id);
  if (!parseResult.success) return ApiErrors.badRequest("ID tidak valid");

  const result = await service.deleteAttendance(
    parseResult.data,
    ctx.session!.user,
  );
  return toAttendanceResultResponse(result);
});
