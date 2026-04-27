import type {
  Salary,
  SalaryComponent,
  SalaryDetail,
  SalaryRevision,
  UserSalaryComponent,
} from "@prisma/client";
import type {
  SalaryComponentDTO,
  SalaryDetailDTO,
  SalaryDetailItemDTO,
  SalaryListItemDTO,
  SalarySlipDTO,
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

type SalaryUserRelation = {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  departmentId: string | null;
  siteId: string | null;
  departments?: { name: string } | null;
  sites?: { name: string } | null;
};

type SalaryActorRelation = {
  id: string;
  name: string | null;
};

type SalaryWithRelations = Salary & {
  user?: SalaryUserRelation;
  details?: SalaryDetail[];
  revisions?: SalaryRevision[];
  auditedBy?: SalaryActorRelation | null;
  approvedBy?: SalaryActorRelation | null;
};

type UserSalaryComponentWithRelations = UserSalaryComponent & {
  component: SalaryComponent;
};

export class SalaryMapper {
  /** Map Prisma salary detail to domain entity. */
  static toDomainDetail(detail: SalaryDetail): SalaryDetailEntity {
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

  /** Map Prisma salary revision to domain entity. */
  static toDomainRevision(revision: SalaryRevision): SalaryRevisionEntity {
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

  /** Map Prisma salary to domain entity. */
  static toDomain(entity: SalaryWithRelations): SalaryWithDetailsEntity {
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
      details: (entity.details ?? []).map((detail) =>
        this.toDomainDetail(detail),
      ),
      revisions: entity.revisions?.map((revision) =>
        this.toDomainRevision(revision),
      ),
      auditedBy: entity.auditedBy ?? null,
      approvedBy: entity.approvedBy ?? null,
    };
  }

  /** Map base salary record to domain entity. */
  static toDomainSalary(entity: Salary): SalaryEntity {
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

  /** Map Prisma salary component to domain entity. */
  static toDomainComponent(entity: SalaryComponent): SalaryComponentEntity {
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

  /** Map Prisma user component to domain entity. */
  static toDomainUserComponent(
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

  /** Map Prisma user component with component relation to domain entity. */
  static toDomainUserComponentWithComponent(
    entity: UserSalaryComponentWithRelations,
  ): UserSalaryComponentWithComponentEntity {
    return {
      ...this.toDomainUserComponent(entity),
      component: this.toDomainComponent(entity.component),
    };
  }

  /** Map domain salary to list DTO. */
  static toListItem(entity: SalaryWithDetailsEntity): SalaryListItemDTO {
    return {
      id: entity.id,
      employeeName: entity.user.name,
      employeeEmail: entity.user.email,
      month: entity.month,
      year: entity.year,
      period: this.formatPeriod(entity.month, entity.year),
      status: entity.status,
      basicSalary: entity.basicSalary,
      totalEarnings: entity.totalEarnings,
      totalDeductions: entity.totalDeductions,
      netSalary: entity.netSalary,
    };
  }

  /** Map domain salaries to list DTOs. */
  static toListItems(entities: SalaryWithDetailsEntity[]): SalaryListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map domain salary to detail DTO. */
  static toDetail(entity: SalaryWithDetailsEntity): SalaryDetailDTO {
    return {
      id: entity.id,
      month: entity.month,
      year: entity.year,
      period: this.formatPeriod(entity.month, entity.year),
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
      details: this.mapDetails(entity.details),
    };
  }

  /** Map domain salary to slip DTO. */
  static toSlip(entity: SalaryWithDetailsEntity): SalarySlipDTO {
    const earnings = entity.details.filter(
      (detail) => detail.type === "EARNING",
    );
    const deductions = entity.details.filter(
      (detail) => detail.type === "DEDUCTION",
    );

    return {
      id: entity.id,
      period: this.formatPeriod(entity.month, entity.year),
      employee: {
        name: entity.user.name,
        email: entity.user.email,
      },
      basicSalary: entity.basicSalary,
      earnings: this.mapDetails(earnings),
      deductions: this.mapDetails(deductions),
      totalEarnings: entity.totalEarnings,
      totalDeductions: entity.totalDeductions,
      netSalary: entity.netSalary,
      paidAt: entity.paidAt?.toISOString() ?? null,
    };
  }

  /** Map domain component to DTO. */
  static componentToDTO(entity: SalaryComponentEntity): SalaryComponentDTO {
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

  /** Map domain components to DTOs. */
  static componentsToDTO(
    entities: SalaryComponentEntity[],
  ): SalaryComponentDTO[] {
    return entities.map((entity) => this.componentToDTO(entity));
  }

  /** Format salary period text. */
  static formatPeriod(month: number, year: number): string {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  /** Map salary detail entities to DTO items. */
  private static mapDetails(
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
}
