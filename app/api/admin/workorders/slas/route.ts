import { adminWorkOrderConfigService } from "@/modules/work-order";
import { slaCreateSchema, slaQuerySchema } from "@/lib/validations/sla";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/slas */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("wo_sla:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat aturan SLA",
    );
  }

  const { searchParams } = req.nextUrl;
  const query = slaQuerySchema.parse({
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "20",
    search: searchParams.get("search") || "",
    workOrderType: searchParams.get("workOrderType") || undefined,
    priority: searchParams.get("priority") || undefined,
    departmentId: searchParams.get("departmentId") || "",
    isActive: searchParams.get("isActive") || undefined,
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortOrder: searchParams.get("sortOrder") || "desc",
  });

  const result = await adminWorkOrderConfigService.getSlas(query);

  if (!result.success || !result.data) {
    return apiError(
      result.error || "Gagal mengambil aturan SLA",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** POST /api/admin/workorders/slas */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_sla:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat aturan SLA",
    );
  }

  const body = await req.json();
  const validatedData = slaCreateSchema.parse(body);
  const result = await adminWorkOrderConfigService.createSla(
    validatedData,
    ctx.session!.user.id,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal membuat aturan SLA",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Aturan SLA berhasil dibuat",
  });
});
