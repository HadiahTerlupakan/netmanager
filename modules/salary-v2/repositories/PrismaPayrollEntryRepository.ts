import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPayrollEntryRepository,
  PayrollEntryWithLines,
  PayrollEntry,
  PayrollLine,
  PayrollEntryStatus,
} from "@/modules/salary-v2/core";

/**
 * Prisma implementation of IPayrollEntryRepository.
 * Handles CRUD for payroll entries and their line items with tenant isolation.
 */
export class PrismaPayrollEntryRepository implements IPayrollEntryRepository {
  async findById(
    id: string,
    tenantId: string,
  ): Promise<PayrollEntryWithLines | null> {
    const record = await prisma.payrollEntryV2.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return record ? this.toEntityWithLines(record) : null;
  }

  async findByRunId(runId: string, tenantId: string): Promise<PayrollEntry[]> {
    const records = await prisma.payrollEntryV2.findMany({
      where: { payrollRunId: runId, tenantId },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByUserAndRun(
    userId: string,
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntryWithLines | null> {
    const record = await prisma.payrollEntryV2.findFirst({
      where: { userId, payrollRunId: runId, tenantId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return record ? this.toEntityWithLines(record) : null;
  }

  async create(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollEntry> {
    const record = await prisma.payrollEntryV2.create({ data });
    return this.toEntity(record);
  }

  async createMany(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">[],
  ): Promise<PayrollEntry[]> {
    if (data.length === 0) return [];

    // Use transaction to ensure atomicity
    const records = await prisma.$transaction(
      data.map((entry) => prisma.payrollEntryV2.create({ data: entry })),
    );
    return records.map((r) => this.toEntity(r));
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<PayrollEntry>,
  ): Promise<PayrollEntry> {
    const existing = await prisma.payrollEntryV2.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prisma.payrollEntryV2.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: PayrollEntryStatus,
    errorMessage?: string,
  ): Promise<PayrollEntry> {
    const existing = await prisma.payrollEntryV2.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    const record = await prisma.payrollEntryV2.update({
      where: { id },
      data: { status, errorMessage: errorMessage ?? null },
    });
    return this.toEntity(record);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await prisma.payrollEntryV2.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    await prisma.payrollEntryV2.delete({ where: { id } });
  }

  async deleteByRunId(runId: string, tenantId: string): Promise<void> {
    await prisma.payrollEntryV2.deleteMany({
      where: { payrollRunId: runId, tenantId },
    });
  }

  async setLines(
    entryId: string,
    tenantId: string,
    lines: Omit<PayrollLine, "id">[],
  ): Promise<PayrollLine[]> {
    // Replace all lines atomically
    const result = await prisma.$transaction(async (tx) => {
      await tx.payrollLineV2.deleteMany({ where: { entryId, tenantId } });
      const created = await Promise.all(
        lines.map((line) =>
          tx.payrollLineV2.create({
            data: {
              entryId,
              tenantId,
              componentId: line.componentId,
              componentCode: line.componentCode,
              componentName: line.componentName,
              category: line.category,
              quantity: line.quantity,
              rate: line.rate,
              amount: line.amount,
              formula: line.formula,
              metadata: (line.metadata as Prisma.InputJsonValue) ?? undefined,
              sortOrder: line.sortOrder,
            },
          }),
        ),
      );
      return created;
    });

    return result.map((r) => this.toLine(r));
  }

  async clearLines(entryId: string, tenantId: string): Promise<void> {
    await prisma.payrollLineV2.deleteMany({ where: { entryId, tenantId } });
  }

  private toEntity(record: {
    id: string;
    payrollRunId: string;
    tenantId: string;
    userId: string;
    employeeType: string;
    taxMethod: string;
    basicSalary: number;
    effectiveSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalTax: number;
    netSalary: number;
    employerCost: number;
    status: string;
    errorMessage: string | null;
    calculatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PayrollEntry {
    return {
      id: record.id,
      payrollRunId: record.payrollRunId,
      tenantId: record.tenantId,
      userId: record.userId,
      employeeType: record.employeeType as PayrollEntry["employeeType"],
      taxMethod: record.taxMethod as PayrollEntry["taxMethod"],
      basicSalary: record.basicSalary,
      effectiveSalary: record.effectiveSalary,
      totalEarnings: record.totalEarnings,
      totalDeductions: record.totalDeductions,
      totalTax: record.totalTax,
      netSalary: record.netSalary,
      employerCost: record.employerCost,
      status: record.status as PayrollEntry["status"],
      errorMessage: record.errorMessage,
      calculatedAt: record.calculatedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toEntityWithLines(record: {
    id: string;
    payrollRunId: string;
    tenantId: string;
    userId: string;
    employeeType: string;
    taxMethod: string;
    basicSalary: number;
    effectiveSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalTax: number;
    netSalary: number;
    employerCost: number;
    status: string;
    errorMessage: string | null;
    calculatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      entryId: string;
      tenantId: string;
      componentId: string | null;
      componentCode: string;
      componentName: string;
      category: string;
      quantity: number;
      rate: number;
      amount: number;
      formula: string | null;
      metadata: unknown;
      sortOrder: number;
    }>;
  }): PayrollEntryWithLines {
    return {
      ...this.toEntity(record),
      lines: record.lines.map((l) => this.toLine(l)),
    };
  }

  private toLine(record: {
    id: string;
    entryId: string;
    tenantId: string;
    componentId: string | null;
    componentCode: string;
    componentName: string;
    category: string;
    quantity: number;
    rate: number;
    amount: number;
    formula: string | null;
    metadata: unknown;
    sortOrder: number;
  }): PayrollLine {
    return {
      id: record.id,
      entryId: record.entryId,
      tenantId: record.tenantId,
      componentId: record.componentId,
      componentCode: record.componentCode,
      componentName: record.componentName,
      category: record.category as PayrollLine["category"],
      quantity: record.quantity,
      rate: record.rate,
      amount: record.amount,
      formula: record.formula,
      metadata: (record.metadata as Record<string, unknown>) ?? null,
      sortOrder: record.sortOrder,
    };
  }
}
