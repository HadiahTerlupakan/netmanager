import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getEmployeeProfileRepository } from "@/modules/salary";
import type { UserSalaryConfig } from "@/modules/salary";

const profileRepo = getEmployeeProfileRepository();

/** GET /api/admin/salary/profiles/[userId] — Get employee payroll profile */
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

/** PUT /api/admin/salary/profiles/[userId] — Update employee payroll profile */
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

  // Update the payroll profile (fields that belong to EmployeePayrollProfile)
  const profile = await profileRepo.update(userId, tenantId, body);

  // Update salary config fields on the User table
  const userSalaryConfig: UserSalaryConfig = {};
  if (body.payPeriodDay !== undefined)
    userSalaryConfig.payPeriodDay = Number(body.payPeriodDay);
  if (body.payDay !== undefined) userSalaryConfig.payDay = Number(body.payDay);
  if (body.woIncentiveEnabled !== undefined)
    userSalaryConfig.woIncentiveEnabled = Boolean(body.woIncentiveEnabled);
  if (body.woIncentiveRate !== undefined)
    userSalaryConfig.woIncentiveRate = Number(body.woIncentiveRate);
  if (body.lateDeductionRate !== undefined)
    userSalaryConfig.lateDeductionRate = Number(body.lateDeductionRate);
  if (body.absentDeductionRate !== undefined)
    userSalaryConfig.absentDeductionRate = Number(body.absentDeductionRate);
  if (body.overtimeRateNormal !== undefined)
    userSalaryConfig.overtimeRateNormal = Number(body.overtimeRateNormal);
  if (body.overtimeRateHoliday !== undefined)
    userSalaryConfig.overtimeRateHoliday = Number(body.overtimeRateHoliday);
  if (body.overtimeRateNational !== undefined)
    userSalaryConfig.overtimeRateNational = Number(body.overtimeRateNational);
  if (body.overtimeCalcTypeNormal !== undefined)
    userSalaryConfig.overtimeCalcTypeNormal = body.overtimeCalcTypeNormal;
  if (body.overtimeCalcTypeHoliday !== undefined)
    userSalaryConfig.overtimeCalcTypeHoliday = body.overtimeCalcTypeHoliday;
  if (body.overtimeCalcTypeNational !== undefined)
    userSalaryConfig.overtimeCalcTypeNational = body.overtimeCalcTypeNational;

  if (Object.keys(userSalaryConfig).length > 0) {
    await profileRepo.updateUserSalaryConfig(userId, userSalaryConfig);
  }

  return apiSuccess(
    { profile },
    { message: "Profil payroll berhasil diperbarui" },
  );
});
