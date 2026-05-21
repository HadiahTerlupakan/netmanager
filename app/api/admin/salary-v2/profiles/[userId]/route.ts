import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getEmployeeProfileRepository } from "@/modules/salary-v2";

const profileRepo = getEmployeeProfileRepository();

/** GET /api/admin/salary-v2/profiles/[userId] — Get employee payroll profile */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat profil payroll",
    );
  }

  const { userId } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const profile = await profileRepo.findByUserId(userId, tenantId);
  if (!profile) {
    return ApiErrors.notFound("Profil payroll karyawan");
  }

  return apiSuccess({ profile });
});

/** PUT /api/admin/salary-v2/profiles/[userId] — Update employee payroll profile */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah profil payroll",
    );
  }

  const { userId } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;
  const body = await req.json();

  const existing = await profileRepo.findByUserId(userId, tenantId);
  if (!existing) {
    return ApiErrors.notFound("Profil payroll karyawan");
  }

  const profile = await profileRepo.update(userId, tenantId, body);

  return apiSuccess(
    { profile },
    { message: "Profil payroll berhasil diperbarui" },
  );
});
