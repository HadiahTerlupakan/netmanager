import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getEmployeeProfileRepository } from "@/modules/salary";

const profileRepo = getEmployeeProfileRepository();

/** GET /api/admin/salary/profiles — List employee payroll profiles with user data */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat profil payroll",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const { searchParams } = req.nextUrl;

  const filter = {
    tenantId,
    ...(searchParams.get("employeeType") && {
      employeeType: searchParams.get("employeeType")!,
    }),
    ...(searchParams.get("payScheduleId") && {
      payScheduleId: searchParams.get("payScheduleId")!,
    }),
    ...(searchParams.get("isActive") && {
      isActive: searchParams.get("isActive") === "true",
    }),
  } as Parameters<typeof profileRepo.findAll>[0];

  const profiles = await profileRepo.findAllWithUserData(filter);

  // Enrich profiles with salary config fields from User table
  const userIds = profiles.map((p) => p.userId);
  const userSalaryMap = await profileRepo.getUserSalaryConfigs(userIds);

  const enrichedProfiles = profiles.map((p) => {
    const salaryConfig = userSalaryMap.get(p.userId);
    return {
      ...p,
      payPeriodDay: salaryConfig?.payPeriodDay ?? 1,
      payDay: salaryConfig?.payDay ?? 25,
      woIncentiveEnabled: salaryConfig?.woIncentiveEnabled ?? false,
      woIncentiveRate: salaryConfig?.woIncentiveRate ?? 0,
      lateDeductionRate: salaryConfig?.lateDeductionRate ?? 0,
      absentDeductionRate: salaryConfig?.absentDeductionRate ?? 0,
      overtimeRateNormal: salaryConfig?.overtimeRateNormal ?? 0,
      overtimeRateHoliday: salaryConfig?.overtimeRateHoliday ?? 0,
      overtimeRateNational: salaryConfig?.overtimeRateNational ?? 0,
      overtimeCalcTypeNormal: salaryConfig?.overtimeCalcTypeNormal ?? "FIXED",
      overtimeCalcTypeHoliday: salaryConfig?.overtimeCalcTypeHoliday ?? "FIXED",
      overtimeCalcTypeNational:
        salaryConfig?.overtimeCalcTypeNational ?? "FIXED",
    };
  });

  return apiSuccess({ profiles: enrichedProfiles });
});
