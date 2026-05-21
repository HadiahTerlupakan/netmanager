import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPayrollComponentRepository } from "@/modules/salary-v2";

const componentRepo = getPayrollComponentRepository();

/** GET /api/admin/salary-v2/components/[id] — Get component detail */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const component = await componentRepo.findById(id, tenantId);
  if (!component) {
    return ApiErrors.notFound("Komponen payroll");
  }

  return apiSuccess({ component });
});

/** PUT /api/admin/salary-v2/components/[id] — Update component */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah komponen payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;
  const body = await req.json();

  const existing = await componentRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Komponen payroll");
  }

  const component = await componentRepo.update(id, tenantId, body);

  return apiSuccess(
    { component },
    { message: "Komponen payroll berhasil diperbarui" },
  );
});

/** DELETE /api/admin/salary-v2/components/[id] — Delete component */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus komponen payroll",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const existing = await componentRepo.findById(id, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Komponen payroll");
  }

  if (existing.isStatutory) {
    return ApiErrors.badRequest("Komponen statutory tidak dapat dihapus");
  }

  await componentRepo.delete(id, tenantId);

  return apiSuccess(null, { message: "Komponen payroll berhasil dihapus" });
});
