import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getSalaryAdvanceRepository,
  getAdvanceManagementService,
  getEmployeeProfileRepository,
} from "@/modules/salary";
import * as z from "zod";

const advanceRepo = getSalaryAdvanceRepository();
const advanceManagement = getAdvanceManagementService();
const profileRepo = getEmployeeProfileRepository();

const requestAdvanceSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  deductionMethod: z.enum(["FULL_NEXT", "INSTALLMENT"]).default("FULL_NEXT"),
  installmentCount: z.number().int().min(1).max(12).nullable().optional(),
});

/** GET /api/mobile/salary/advances — List current user's advances */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("m_salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kasbon",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const userId = ctx.session!.user.id!;

  const advances = await advanceRepo.findAll({ tenantId, userId });

  return apiSuccess({ advances });
});

/** POST /api/mobile/salary/advances — Request new advance */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("m_salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengajukan kasbon",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const userId = ctx.session!.user.id!;
  const body = await req.json();

  const parsed = requestAdvanceSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(parsed.error.message);
  }

  // Ambil basicSalary server-side dari EmployeePayrollProfile.
  // JANGAN trust body request — karyawan bisa kirim nilai palsu untuk lolos validasi maxPercentOfSalary.
  const profile = await profileRepo.findByUserId(userId, tenantId);
  if (!profile) {
    return ApiErrors.badRequest(
      "Profil penggajian belum di-setup untuk akun Anda. Hubungi admin.",
    );
  }

  const { amount, reason, deductionMethod, installmentCount } = parsed.data;

  const result = await advanceManagement.requestAdvance({
    tenantId,
    userId,
    amount,
    basicSalary: profile.basicSalary,
    reason,
    deductionMethod,
    installmentCount: installmentCount ?? null,
  });

  if (!result.success) {
    return ApiErrors.badRequest(result.message);
  }

  return apiSuccess(
    { advance: result.advance },
    { message: "Pengajuan kasbon berhasil dikirim" },
  );
});
