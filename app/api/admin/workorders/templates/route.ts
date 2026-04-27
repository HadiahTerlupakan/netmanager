import { adminWorkOrderConfigService } from "@/modules/work-order";
import {
  workOrderTemplateCreateSchema,
  workOrderTemplateQuerySchema,
} from "@/lib/validations/workorder-template";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/templates */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("wo_template:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat template work order",
    );
  }

  const { searchParams } = req.nextUrl;
  const query = workOrderTemplateQuerySchema.parse({
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "20",
    search: searchParams.get("search") || "",
    type: searchParams.get("type") || undefined,
    priority: searchParams.get("priority") || undefined,
    departmentId: searchParams.get("departmentId") || "",
    isActive: searchParams.get("isActive") || undefined,
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortOrder: searchParams.get("sortOrder") || "desc",
  });

  const result = await adminWorkOrderConfigService.getTemplates(query);

  if (!result.success || !result.data) {
    return apiError(
      result.error || "Gagal mengambil template work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** POST /api/admin/workorders/templates */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_template:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat template work order",
    );
  }

  const body = await req.json();
  const validatedData = workOrderTemplateCreateSchema.parse(body);
  const result = await adminWorkOrderConfigService.createTemplate(
    validatedData,
    ctx.session!.user.id,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal membuat template work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Template work order berhasil dibuat",
  });
});
