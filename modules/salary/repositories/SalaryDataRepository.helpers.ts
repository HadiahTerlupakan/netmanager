import {
  EmployeeType as PrismaEmployeeType,
  type Prisma,
} from "@prisma/client";
import type { SalaryUserFilters } from "../domain/ports/ISalaryUserRepository";

/** Membangun select list salary user. */
export function buildSalaryUserListSelect() {
  return {
    id: true,
    name: true,
    email: true,
    employeeType: true,
    basicSalary: true,
    overtimeRateNormal: true,
    overtimeCalcTypeNormal: true,
    overtimeRateHoliday: true,
    overtimeCalcTypeHoliday: true,
    overtimeRateNational: true,
    overtimeCalcTypeNational: true,
    woIncentiveRate: true,
    lateDeductionRate: true,
    absentDeductionRate: true,
    joinDate: true,
    ptkpStatus: true,
    bpjsKesehatan: true,
    bpjsKetenagakerjaan: true,
    departments: { select: { name: true } },
    role: { select: { name: true } },
  } satisfies Prisma.UserSelect;
}

/** Membangun select onboarding list user salary. */
export function buildActiveSalaryListSelect() {
  return {
    id: true,
    name: true,
    email: true,
    employeeType: true,
    basicSalary: true,
  } satisfies Prisma.UserSelect;
}

/** Membangun select detail user salary. */
export function buildSalaryUserDetailSelect() {
  return {
    id: true,
    name: true,
    email: true,
    image: true,
    employeeType: true,
    basicSalary: true,
    overtimeRateNormal: true,
    overtimeCalcTypeNormal: true,
    overtimeRateHoliday: true,
    overtimeCalcTypeHoliday: true,
    overtimeRateNational: true,
    overtimeCalcTypeNational: true,
    woIncentiveRate: true,
    lateDeductionRate: true,
    absentDeductionRate: true,
    joinDate: true,
    ptkpStatus: true,
    bpjsKesehatan: true,
    bpjsKetenagakerjaan: true,
    departments: { select: { name: true } },
    userSalaryComponents: {
      where: { isActive: true },
      include: { component: true },
      orderBy: { component: { type: "asc" } },
    },
  } satisfies Prisma.UserSelect;
}

/** Membangun select config payroll user. */
export function buildSalaryConfigSelect() {
  return {
    id: true,
    name: true,
    basicSalary: true,
    employeeType: true,
    departmentId: true,
    siteId: true,
    payPeriodDay: true,
    payDay: true,
    woIncentiveEnabled: true,
    woIncentiveRate: true,
    lateDeductionRate: true,
    absentDeductionRate: true,
    overtimeRateNormal: true,
    overtimeRateHoliday: true,
    overtimeRateNational: true,
    overtimeCalcTypeNormal: true,
    overtimeCalcTypeHoliday: true,
    overtimeCalcTypeNational: true,
    workDays: true,
    joinDate: true,
    ptkpStatus: true,
    bpjsKesehatan: true,
    bpjsKetenagakerjaan: true,
  } satisfies Prisma.UserSelect;
}

/** Membangun where clause user aktif dengan config payroll. */
export function buildSalaryUserConfigWhere(filters?: SalaryUserFilters) {
  const where: Prisma.UserWhereInput = {
    isActive: true,
    basicSalary: { not: null as number | null },
  };

  if (filters?.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters?.siteId) {
    where.siteId = filters.siteId;
  }
  if (filters?.employeeType) {
    where.employeeType = { equals: filters.employeeType as PrismaEmployeeType };
  }

  return where;
}
