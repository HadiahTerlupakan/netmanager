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

const addSalaryUserSchema = z.object({
  userId: z.uuid({ error: "User ID wajib diisi" }),
  basicSalary: z.number().min(0).optional().default(0),
  employeeType: z.enum(EMPLOYEE_TYPES).optional().default("KARYAWAN"),
  overtimeRateNormal: z.number().min(0).optional(),
  overtimeCalcTypeNormal: z.enum(RATE_TYPES).optional().default("PER_HOUR"),
  overtimeRateHoliday: z.number().min(0).optional(),
  overtimeCalcTypeHoliday: z.enum(RATE_TYPES).optional().default("PER_HOUR"),
  overtimeRateNational: z.number().min(0).optional(),
  overtimeCalcTypeNational: z.enum(RATE_TYPES).optional().default("PER_HOUR"),
  woIncentiveRate: z.number().min(0).optional(),
  lateDeductionRate: z.number().min(0).optional(),
  absentDeductionRate: z.number().min(0).optional(),
  joinDate: z.string().optional().nullable(),
  ptkpStatus: z.enum(PTKP_STATUSES).optional().nullable(),
  bpjsKesehatan: z.boolean().optional(),
  bpjsKetenagakerjaan: z.boolean().optional(),
});

// GET - List users with salary setup
export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data gaji",
    );
  }

  const result = await service.listUsers();

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

// POST - Add user to salary list (set basicSalary and config)
export const POST = createHandler(
  {
    auth: true,
    schema: addSalaryUserSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menambah user ke penggajian",
      );
    }

    const {
      userId,
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

    const result = await service.addUser({
      userId,
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
      message: "User berhasil ditambahkan ke daftar gaji",
    });
  },
);
