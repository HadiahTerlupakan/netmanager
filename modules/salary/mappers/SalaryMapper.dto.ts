import type {
  SalaryDetailDTO,
  SalaryListItemDTO,
  SalarySlipDTO,
} from "../dto/SalaryDTO";
import type { SalaryWithDetailsEntity } from "../domain/entities/SalaryEntity";
import {
  formatSalaryPeriod,
  mapSalaryDetailItems,
} from "./SalaryMapper.helpers";

/** Memetakan salary domain ke DTO list. */
export function toSalaryListItemDTO(
  entity: SalaryWithDetailsEntity,
): SalaryListItemDTO {
  return {
    id: entity.id,
    employeeName: entity.user.name,
    employeeEmail: entity.user.email,
    month: entity.month,
    year: entity.year,
    period: formatSalaryPeriod(entity.month, entity.year),
    status: entity.status,
    basicSalary: entity.basicSalary,
    totalEarnings: entity.totalEarnings,
    totalDeductions: entity.totalDeductions,
    netSalary: entity.netSalary,
  };
}

/** Memetakan salary domain ke DTO detail. */
export function toSalaryDetailDTO(
  entity: SalaryWithDetailsEntity,
): SalaryDetailDTO {
  return {
    id: entity.id,
    month: entity.month,
    year: entity.year,
    period: formatSalaryPeriod(entity.month, entity.year),
    status: entity.status,
    basicSalary: entity.basicSalary,
    totalEarnings: entity.totalEarnings,
    totalDeductions: entity.totalDeductions,
    netSalary: entity.netSalary,
    calculatedAt: entity.calculatedAt?.toISOString() ?? null,
    auditedAt: entity.auditedAt?.toISOString() ?? null,
    auditNotes: entity.auditNotes,
    approvedAt: entity.approvedAt?.toISOString() ?? null,
    paidAt: entity.paidAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    employee: {
      id: entity.user.id,
      name: entity.user.name,
      email: entity.user.email,
    },
    auditedBy: entity.auditedBy ?? null,
    approvedBy: entity.approvedBy ?? null,
    details: mapSalaryDetailItems(entity.details),
  };
}

/** Memetakan salary domain ke DTO slip. */
export function toSalarySlipDTO(
  entity: SalaryWithDetailsEntity,
): SalarySlipDTO {
  const earnings = entity.details.filter((detail) => detail.type === "EARNING");
  const deductions = entity.details.filter(
    (detail) => detail.type === "DEDUCTION",
  );

  return {
    id: entity.id,
    period: formatSalaryPeriod(entity.month, entity.year),
    employee: {
      name: entity.user.name,
      email: entity.user.email,
    },
    basicSalary: entity.basicSalary,
    earnings: mapSalaryDetailItems(earnings),
    deductions: mapSalaryDetailItems(deductions),
    totalEarnings: entity.totalEarnings,
    totalDeductions: entity.totalDeductions,
    netSalary: entity.netSalary,
    paidAt: entity.paidAt?.toISOString() ?? null,
  };
}
