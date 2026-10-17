import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  recordWorkOrderExport,
  workOrderExportLogSchema,
  type WorkOrderExportLogInput,
} from "@/modules/work-order";

const HTTP_CREATED = 201;

/**
 * POST /api/admin/workorders/exports
 * Catat unduhan PDF daftar work order ke Log Aktivitas. PDF dibuat di browser,
 * jadi klien melapor ke sini setelah berkas tersimpan.
 */
export const POST = createHandler<WorkOrderExportLogInput>(
  { auth: true, schema: workOrderExportLogSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("workorders:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengunduh work order",
      );
    }

    const user = ctx.session!.user;
    recordWorkOrderExport({
      ...ctx.validated,
      actorId: user.id as string,
      tenantId: user.tenantId as string | undefined,
    });
    return apiSuccess(null, { status: HTTP_CREATED });
  },
);
