import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPayrollRunRepository } from "@/modules/salary";

const runRepo = getPayrollRunRepository();

/** GET /api/admin/salary/runs/[id] — Get payroll run detail */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const run = await runRepo.findById(id, tenantId);
  if (!run) {
    return ApiErrors.notFound("Payroll run");
  }

  return apiSuccess({ run });
});

/** PUT /api/admin/salary/runs/[id] — Update payroll run */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah payroll run",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;
  const body = await req.json();

  const existing = await runRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Payroll run");
  }

  const run = await runRepo.update(id, tenantId, body);

  return apiSuccess({ run }, { message: "Payroll run berhasil diperbarui" });
});

/** DELETE /api/admin/salary/runs/[id] — Delete payroll run */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus payroll run",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const existing = await runRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Payroll run");
  }

  if (existing.status !== "DRAFT") {
    return ApiErrors.badRequest(
      "Hanya payroll run berstatus DRAFT yang dapat dihapus",
    );
  }

  await runRepo.delete(id, tenantId);

  return apiSuccess(null, { message: "Payroll run berhasil dihapus" });
});
