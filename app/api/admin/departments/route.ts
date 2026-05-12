import { hasPermission } from "@/lib/rbac";
import { getDepartmentService } from "@/modules/roles";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

const service = getDepartmentService();

/**
 * GET /api/admin/departments - List all departments
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || undefined;
  const reminderOnly = searchParams.get("reminderOnly") === "true";

  // Permission check
  // If query param 'reminderOnly' is true, allow any authenticated user (for dropdowns)
  // Otherwise require department:read
  const canReadDepartment = await hasPermission("department:read");
  const canCreateUser = await hasPermission("users:create");

  if (!reminderOnly && !canReadDepartment && !canCreateUser) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat departemen (Butuh: department:read atau users:create)",
    );
  }

  const result = await service.getDepartments({
    ...(search ? { search } : {}),
    reminderOnly,
  });

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

/**
 * POST /api/admin/departments - Create new department
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("department:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat departemen",
    );
  }

  const body = await req.json();

  const result = await service.createDepartment(body, ctx.session!.user.id);

  if (!result.success) {
    if (result.code === "VALIDATION_ERROR") {
      return apiError(
        result.error || "Data tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    if (result.code === "DUPLICATE_NAME") {
      return ApiErrors.conflict("Nama departemen sudah ada");
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Departemen berhasil dibuat",
  });
});
