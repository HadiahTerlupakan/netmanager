import { adminWorkOrderConfigService } from "@/modules/work-order";
import {
  workOrderEscalationCreateSchema,
  workOrderEscalationQuerySchema,
} from "@/lib/validations/workorder-escalation";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/escalations */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("wo_escalation:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat aturan eskalasi",
    );
  }

  const { searchParams } = req.nextUrl;
  const query = workOrderEscalationQuerySchema.parse({
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || "20",
    search: searchParams.get("search") || "",
    slaId: searchParams.get("slaId") || "",
    workOrderType: searchParams.get("workOrderType") || undefined,
    priority: searchParams.get("priority") || undefined,
    departmentId: searchParams.get("departmentId") || "",
    escalationLevel: searchParams.get("escalationLevel") || undefined,
    isActive: searchParams.get("isActive") || undefined,
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortOrder: searchParams.get("sortOrder") || "desc",
  });

  const result = await adminWorkOrderConfigService.getEscalations(query);

  if (!result.success || !result.data) {
    return apiError(
      result.error || "Gagal mengambil aturan eskalasi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** POST /api/admin/workorders/escalations */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_escalation:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat aturan eskalasi",
    );
  }

  const body = await req.json();
  const validatedData = workOrderEscalationCreateSchema.parse(body);
  const result = await adminWorkOrderConfigService.createEscalation(
    validatedData,
    ctx.session!.user.id,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal membuat aturan eskalasi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Aturan eskalasi berhasil dibuat",
  });
});
