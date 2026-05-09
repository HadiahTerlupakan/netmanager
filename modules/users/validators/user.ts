/**
 * User Validation Schemas
 * Comprehensive validation for user management endpoints
 */

import * as z from "zod";
import {
  paginationSchema,
  idSchema,
  optionalIdSchema,
} from "@/lib/validations/common";
import { workDaysSchema, workDaysOptionalSchema } from "./workDays.validator";

/**
 * User list filters schema
 */
export const userFilterSchema = paginationSchema.and(
  z.object({
    roleId: optionalIdSchema,
    siteId: optionalIdSchema,
    departmentId: optionalIdSchema,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    search: z.string().optional(),
    isSales: z
      .string()
      .optional()
      .transform((val) => val === "true"),
  }),
);

/**
 * Working hour modes
 */
export const workingHourModeEnum = z.enum(["FIXED", "FLEXIBLE", "SHIFT"]);
export const attendanceGeofencePolicyEnum = z.enum([
  "STRICT",
  "WARN",
  "DISABLED",
]);

/**
 * Overtime calculation types
 */
export const overtimeCalcTypeEnum = z.enum([
  "PER_HOUR",
  "DAILY_SALARY",
  "FIXED",
  "PERCENTAGE",
]);

/**
 * Target schema options
 */
export const targetSchemaEnum = z.enum([
  "REVENUE",
  "QUANTITY",
  "POINTS",
  "MONTHLY_RESET",
  "ACCUMULATED",
]);

/**
 * Create user schema
 */
export const createUserSchema = z.object({
  email: z.email({ error: "Format email tidak valid" }),
  name: z.string().min(1, "Nama wajib diisi"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  phone: z.string().optional(),
  roleId: optionalIdSchema,
  siteId: optionalIdSchema,
  departmentId: optionalIdSchema,
  isActive: z.boolean().default(true),
  isSales: z.boolean().default(false),
  isAttendanceRequired: z.boolean().default(true),
  tenantId: optionalIdSchema,

  // Multi-site support
  userSites: z
    .array(
      z.object({
        siteId: idSchema,
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),

  // Working hours configuration
  workingHourMode: workingHourModeEnum.default("FIXED"),
  attendanceGeofencePolicy: attendanceGeofencePolicyEnum.default("WARN"),
  startWorkTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .default("09:00"),
  endWorkTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .default("17:00"),
  workDays: workDaysSchema.default("Mon,Tue,Wed,Thu,Fri"),
  flexibleTargetHour: z.number().int().min(1).max(24).default(8),
  shiftId: optionalIdSchema,

  // Sales configuration
  canvasingTarget: z.number().int().min(0).default(50),
  targetSchema: targetSchemaEnum.default("MONTHLY_RESET"),

  // Salary configuration
  basicSalary: z.number().min(0).optional(),
  payPeriodDay: z.number().int().min(1).max(31).default(25),
  payDay: z.number().int().min(1).max(31).default(1),

  // Overtime rates
  overtimeRateNormal: z.number().min(0).default(0),
  overtimeRateHoliday: z.number().min(0).default(0),
  overtimeRateNational: z.number().min(0).default(0),
  overtimeCalcTypeNormal: overtimeCalcTypeEnum.default("PER_HOUR"),
  overtimeCalcTypeHoliday: overtimeCalcTypeEnum.default("PER_HOUR"),
  overtimeCalcTypeNational: overtimeCalcTypeEnum.default("PER_HOUR"),

  // Incentives and deductions
  woIncentiveEnabled: z.boolean().default(false),
  woIncentiveRate: z.number().min(0).default(0),
  lateDeductionRate: z.number().min(0).default(0),
  absentDeductionRate: z.number().min(0).default(0),

  // Leave quotas initialization
  leaveQuotas: z.record(z.string(), z.number()).optional(),
});

/**
 * Update user schema - all fields optional
 */
export const updateUserSchema = z
  .object({
    email: z.email({ error: "Format email tidak valid" }).optional(),
    name: z.string().min(1, "Nama tidak boleh kosong").optional(),
    password: z.string().min(8, "Password minimal 8 karakter").optional(),
    phone: z.string().optional(),
    roleId: optionalIdSchema,
    siteId: optionalIdSchema,
    isAttendanceRequired: z.boolean().optional(),
    departmentId: optionalIdSchema,
    isActive: z.boolean().optional(),
    isSales: z.boolean().optional(),
    tenantId: optionalIdSchema,

    // Multi-site support
    userSites: z
      .array(
        z.object({
          siteId: idSchema,
          isPrimary: z.boolean().default(false),
        }),
      )
      .optional(),

    // Working hours configuration
    workingHourMode: workingHourModeEnum.optional(),
    attendanceGeofencePolicy: attendanceGeofencePolicyEnum.optional(),
    startWorkTime: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    endWorkTime: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    workDays: workDaysOptionalSchema,
    flexibleTargetHour: z.number().int().min(1).max(24).optional(),
    shiftId: optionalIdSchema,

    // Sales configuration
    canvasingTarget: z.number().int().min(0).optional(),
    targetSchema: targetSchemaEnum.optional(),

    // Salary configuration
    basicSalary: z.number().min(0).optional(),
    payPeriodDay: z.number().int().min(1).max(31).optional(),
    payDay: z.number().int().min(1).max(31).optional(),

    // Overtime rates
    overtimeRateNormal: z.number().min(0).optional(),
    overtimeRateHoliday: z.number().min(0).optional(),
    overtimeRateNational: z.number().min(0).optional(),
    overtimeCalcTypeNormal: overtimeCalcTypeEnum.optional(),
    overtimeCalcTypeHoliday: overtimeCalcTypeEnum.optional(),
    overtimeCalcTypeNational: overtimeCalcTypeEnum.optional(),

    // Incentives and deductions
    woIncentiveEnabled: z.boolean().optional(),
    woIncentiveRate: z.number().min(0).optional(),
    lateDeductionRate: z.number().min(0).optional(),
    absentDeductionRate: z.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/**
 * User ID parameter schema
 */
export const userIdParamSchema = z.object({
  id: idSchema,
});

/**
 * Force logout schema (no body needed, just validation)
 */
export const forceLogoutSchema = z.object({});

// Legacy schemas for backward compatibility
export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .pipe(z.email({ error: "Format email tidak valid" })),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  departmentId: z
    .string()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  siteId: z
    .string()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  isActive: z.boolean().optional().default(true),
  role: z.string().optional(), // Legacy field
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  departmentId: z
    .string()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  siteId: z
    .string()
    .optional()
    .or(z.literal("").transform((): undefined => undefined)),
  isActive: z.boolean().optional(),
});
