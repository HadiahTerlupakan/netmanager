import type {
  Salary,
  SalaryComponent,
  SalaryDetail,
  SalaryRevision,
  UserSalaryComponent,
} from "@prisma/client";
import type {
  SalaryComponentDTO,
  SalaryDetailItemDTO,
  SalaryListItemDTO,
  SalarySlipDTO,
  SalaryDetailDTO,
} from "../dto/SalaryDTO";
import type {
  SalaryComponentEntity,
  UserSalaryComponentEntity,
  UserSalaryComponentWithComponentEntity,
} from "../domain/entities/SalaryComponentEntity";
import type {
  SalaryDetailEntity,
  SalaryEntity,
  SalaryRevisionEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export type SalaryUserRelation = {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  departmentId: string | null;
  siteId: string | null;
  departments?: { name: string } | null;
  sites?: { name: string } | null;
};

export type SalaryActorRelation = {
  id: string;
  name: string | null;
};

export type SalaryWithRelations = Salary & {
  user?: SalaryUserRelation;
  details?: SalaryDetail[];
  revisions?: SalaryRevision[];
  auditedBy?: SalaryActorRelation | null;
  approvedBy?: SalaryActorRelation | null;
};

export type UserSalaryComponentWithRelations = UserSalaryComponent & {
  component: SalaryComponent;
};

/** Memetakan detail salary domain ke item DTO. */
export function mapSalaryDetailItems(
  details: SalaryDetailEntity[],
): SalaryDetailItemDTO[] {
  return details.map((detail) => ({
    id: detail.id,
    name: detail.name,
    type: detail.type,
    quantity: detail.quantity,
    rate: detail.rate,
    amount: detail.amount,
    notes: detail.notes,
  }));
}

/** Memformat periode salary dalam bahasa Indonesia. */
export function formatSalaryPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Memetakan salary detail Prisma ke domain. */
export function toSalaryDetailEntity(detail: SalaryDetail): SalaryDetailEntity {
  return {
    id: detail.id,
    salaryId: detail.salaryId,
    name: detail.name,
    type: detail.type,
    quantity: detail.quantity,
    rate: detail.rate,
    amount: detail.amount,
    notes: detail.notes,
    loanPaymentId: detail.loanPaymentId,
  };
}

/** Memetakan salary revision Prisma ke domain. */
export function toSalaryRevisionEntity(
  revision: SalaryRevision,
): SalaryRevisionEntity {
  return {
    id: revision.id,
    salaryId: revision.salaryId,
    field: revision.field,
    oldValue: revision.oldValue,
    newValue: revision.newValue,
    reason: revision.reason,
    revisedById: revision.revisedById,
    createdAt: revision.createdAt,
  };
}

/** Memetakan salary base Prisma ke domain. */
export function toSalaryEntity(entity: Salary): SalaryEntity {
  return {
    id: entity.id,
    userId: entity.userId,
    month: entity.month,
    year: entity.year,
    status: entity.status,
    basicSalary: entity.basicSalary,
    totalEarnings: entity.totalEarnings,
    totalDeductions: entity.totalDeductions,
    netSalary: entity.netSalary,
    auditNotes: entity.auditNotes,
    calculatedAt: entity.calculatedAt,
    auditedAt: entity.auditedAt,
    approvedAt: entity.approvedAt,
    paidAt: entity.paidAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/** Memetakan salary berelasi Prisma ke domain detail lengkap. */
export function toSalaryWithDetailsEntity(
  entity: SalaryWithRelations,
): SalaryWithDetailsEntity {
  return {
    ...toSalaryEntity(entity),
    user: {
      id: entity.user?.id ?? entity.userId,
      name: entity.user?.name ?? null,
      email: entity.user?.email ?? "",
      employeeType: entity.user?.employeeType ?? "",
      departmentId: entity.user?.departmentId ?? null,
      siteId: entity.user?.siteId ?? null,
      departments: entity.user?.departments,
      sites: entity.user?.sites,
    },
    details: (entity.details ?? []).map(toSalaryDetailEntity),
    revisions: (entity.revisions ?? []).map(toSalaryRevisionEntity),
    auditedBy: entity.auditedBy ?? null,
    approvedBy: entity.approvedBy ?? null,
  };
}

/** Memetakan komponen salary Prisma ke domain. */
export function toSalaryComponentEntity(
  entity: SalaryComponent,
): SalaryComponentEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    rateType: entity.rateType,
    defaultAmount: entity.defaultAmount,
    description: entity.description,
    isActive: entity.isActive,
    sortOrder: entity.sortOrder,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/** Memetakan assignment komponen user Prisma ke domain. */
export function toUserSalaryComponentEntity(
  entity: UserSalaryComponent,
): UserSalaryComponentEntity {
  return {
    id: entity.id,
    userId: entity.userId,
    componentId: entity.componentId,
    amount: entity.amount,
    notes: entity.notes,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/** Memetakan assignment komponen user dengan relasi komponen ke domain. */
export function toUserSalaryComponentWithComponentEntity(
  entity: UserSalaryComponentWithRelations,
): UserSalaryComponentWithComponentEntity {
  return {
    ...toUserSalaryComponentEntity(entity),
    component: toSalaryComponentEntity(entity.component),
  };
}

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

/** Memetakan komponen salary domain ke DTO. */
export function toSalaryComponentDTO(
  entity: SalaryComponentEntity,
): SalaryComponentDTO {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    rateType: entity.rateType,
    defaultAmount: entity.defaultAmount,
    description: entity.description,
    isActive: entity.isActive,
    sortOrder: entity.sortOrder,
  };
}
