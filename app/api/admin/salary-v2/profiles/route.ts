import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getEmployeeProfileRepository } from "@/modules/salary-v2";

const profileRepo = getEmployeeProfileRepository();

/** GET /api/admin/salary-v2/profiles — List employee payroll profiles */
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

  const profiles = await profileRepo.findAll(filter);

  return apiSuccess({ profiles });
});
