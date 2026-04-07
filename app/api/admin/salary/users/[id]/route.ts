import { getSalaryUserService } from "@/modules/salary";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import * as z from "zod";
import { EmployeeType, RateType, PtkpStatus } from "@prisma/client";

const service = getSalaryUserService();

const updateSalaryConfigSchema = z.object({
  basicSalary: z.union([z.number(), z.string()]).optional().nullable(),
  employeeType: z.nativeEnum(EmployeeType).optional(),
  overtimeRateNormal: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeNormal: z.nativeEnum(RateType).optional(),
  overtimeRateHoliday: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeHoliday: z.nativeEnum(RateType).optional(),
  overtimeRateNational: z.union([z.number(), z.string()]).optional().nullable(),
  overtimeCalcTypeNational: z.nativeEnum(RateType).optional(),
  woIncentiveRate: z.union([z.number(), z.string()]).optional().nullable(),
  lateDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
  absentDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
  joinDate: z.string().optional().nullable(),
  ptkpStatus: z.nativeEnum(PtkpStatus).optional().nullable(),
  bpjsKesehatan: z.boolean().optional(),
  bpjsKetenagakerjaan: z.boolean().optional(),
});

// GET - Get user salary details
export const GET = createHandler({ auth: true }, async (req, ctx) => {
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
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
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
