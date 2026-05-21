import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { calculatePayrollRun } from "@/modules/salary";

/** POST /api/admin/salary/runs/[id]/calculate — Trigger calculation for a payroll run */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:calculate"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghitung payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const result = await calculatePayrollRun(id, tenantId);

  if (result.success === false) {
    if (result.error.code === "NOT_FOUND") {
      return ApiErrors.notFound("Payroll run");
    }
    return ApiErrors.badRequest(result.error.message);
  }

  return apiSuccess(result.data, {
    message: `Kalkulasi selesai: ${result.data.calculated} berhasil, ${result.data.errors} gagal`,
  });
});
