import { getSalaryUserService } from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";

const service = getSalaryUserService();
const EMPLOYEE_TYPES = ["KARYAWAN"] as const;
const RATE_TYPES = ["FIXED", "PER_HOUR", "PERCENTAGE", "DAILY_SALARY"] as const;
const PTKP_STATUSES = [
  "TK_0",
  "TK_1",
  "TK_2",
  "TK_3",
  "K_0",
  "K_1",
  "K_2",
  "K_3",
  "KI_0",
  "KI_1",
  "KI_2",
  "KI_3",
] as const;

const updateSalaryConfigSchema = z.object({
  basicSalary: z.union([z.number(), z.string()]).optional().nullable(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  overtimeRateNormal: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeNormal: z.enum(RATE_TYPES).optional(),
  overtimeRateHoliday: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeHoliday: z.enum(RATE_TYPES).optional(),
  overtimeRateNational: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeNational: z.enum(RATE_TYPES).optional(),
  woIncentiveRate: z.union([z.number(), z.string()]).optional().nullable(),
  lateDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
  absentDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
  joinDate: z.string().optional().nullable(),
  ptkpStatus: z.enum(PTKP_STATUSES).optional().nullable(),
  bpjsKesehatan: z.boolean().optional(),
  bpjsKetenagakerjaan: z.boolean().optional(),
});

// GET - Get user salary details
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data gaji",
    );
  }

  const { id: userId } = ctx.params;
  const result = await service.getUser(userId);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("User");
    }

    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

// PUT - Update user salary config
export const PUT = createHandler(
  {
    auth: true,
    schema: updateSalaryConfigSchema,
  },
  async (req, ctx) => {
    if (!(await hasPermission("salary:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah konfigurasi gaji",
      );
    }

    const { id } = ctx.params;
    const {
      basicSalary,
      employeeType,
      overtimeRateNormal,
      overtimeCalcTypeNormal,
      overtimeRateHoliday,
      overtimeCalcTypeHoliday,
      overtimeRateNational,
      overtimeCalcTypeNational,
      woIncentiveRate,
      lateDeductionRate,
      absentDeductionRate,
      joinDate,
      ptkpStatus,
      bpjsKesehatan,
      bpjsKetenagakerjaan,
    } = ctx.validated;

    const result = await service.updateUser(id, {
      basicSalary,
      employeeType,
      overtimeRateNormal,
      overtimeCalcTypeNormal,
      overtimeRateHoliday,
      overtimeCalcTypeHoliday,
      overtimeRateNational,
      overtimeCalcTypeNational,
      woIncentiveRate,
      lateDeductionRate,
      absentDeductionRate,
      joinDate,
      ptkpStatus,
      bpjsKesehatan,
      bpjsKetenagakerjaan,
    });

    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(null, {
      message: "Konfigurasi gaji berhasil diperbarui",
    });
  },
);

// DELETE - Remove user from salary list
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus dari penggajian",
    );
  }

  const { id } = ctx.params;

  const result = await service.removeUser(id);

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(null, {
    message: "User berhasil dihapus dari daftar gaji",
  });
});
