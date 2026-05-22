import { prismaAuth } from "@/lib/prisma";
import type {
  IPayrollComponentRepository,
  ComponentFilter,
  PayrollComponent,
} from "@/modules/salary/core";

/**
 * Prisma implementation of IPayrollComponentRepository.
 * Handles CRUD for payroll component definitions with tenant isolation.
 */
export class PrismaPayrollComponentRepository implements IPayrollComponentRepository {
  async findById(
    id: string,
    tenantId: string,
  ): Promise<PayrollComponent | null> {
    const record = await prismaAuth.payrollComponent.findFirst({
      where: { id, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByCode(
    code: string,
    tenantId: string,
  ): Promise<PayrollComponent | null> {
    const record = await prismaAuth.payrollComponent.findFirst({
      where: { code, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findAll(filter: ComponentFilter): Promise<PayrollComponent[]> {
    const records = await prismaAuth.payrollComponent.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.category && { category: filter.category }),
        ...(filter.isActive !== undefined && { isActive: filter.isActive }),
        ...(filter.isStatutory !== undefined && {
          isStatutory: filter.isStatutory,
        }),
      },
      orderBy: { sortOrder: "asc" },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(
    data: Omit<PayrollComponent, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollComponent> {
    const record = await prismaAuth.payrollComponent.create({ data });
    return this.toEntity(record);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<PayrollComponent>,
  ): Promise<PayrollComponent> {
    const existing = await prismaAuth.payrollComponent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollComponent not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prismaAuth.payrollComponent.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await prismaAuth.payrollComponent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollComponent not found: ${id}`);
    }

    await prismaAuth.payrollComponent.delete({ where: { id } });
  }

  private toEntity(record: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    category: string;
    calculationType: string;
    taxable: boolean;
    applicableTo: string[];
    isStatutory: boolean;
    formula: string | null;
    defaultAmount: number | null;
    sortOrder: number;
    isActive: boolean;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PayrollComponent {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      code: record.code,
      category: record.category as PayrollComponent["category"],
      calculationType:
        record.calculationType as PayrollComponent["calculationType"],
      taxable: record.taxable,
      applicableTo: record.applicableTo as PayrollComponent["applicableTo"],
      isStatutory: record.isStatutory,
      formula: record.formula,
      defaultAmount: record.defaultAmount,
      sortOrder: record.sortOrder,
      isActive: record.isActive,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
