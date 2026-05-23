import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPayrollEntryRepository,
  PayrollEntryWithLines,
  PayrollEntry,
  PayrollEntrySummary,
  PayrollEntryEventDetails,
  PayrollLine,
  PayrollEntryStatus,
} from "@/modules/salary/core";

const BPJS_EMPLOYEE_CODES = ["BPJS_KES_EE", "BPJS_JHT_EE", "BPJS_JP_EE"];

const BPJS_EMPLOYER_CODES = [
  "BPJS_KES_ER",
  "BPJS_JHT_ER",
  "BPJS_JP_ER",
  "BPJS_JKK_ER",
  "BPJS_JKM_ER",
];

const ADVANCE_CODE_PREFIX = "ADVANCE_";

/**
 * Prisma implementation of IPayrollEntryRepository.
 * Handles CRUD for payroll entries and their line items with tenant isolation.
 */
export class PrismaPayrollEntryRepository implements IPayrollEntryRepository {
  async findCalculatedSummaries(
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntrySummary[]> {
    const records = await prisma.payrollEntry.findMany({
      where: { payrollRunId: runId, tenantId, status: "CALCULATED" },
      select: {
        id: true,
        userId: true,
        basicSalary: true,
        totalEarnings: true,
        totalTax: true,
        netSalary: true,
      },
    });
    return records;
  }

  async findCalculatedEventDetails(
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntryEventDetails[]> {
    const records = await prisma.payrollEntry.findMany({
      where: { payrollRunId: runId, tenantId, status: "CALCULATED" },
      select: {
        id: true,
        userId: true,
        basicSalary: true,
        totalEarnings: true,
        totalDeductions: true,
        totalTax: true,
        netSalary: true,
        employerCost: true,
        lines: {
          select: { componentCode: true, amount: true },
        },
      },
    });

    return records.map((record) => {
      let bpjsEmployee = 0;
      let bpjsEmployer = 0;
      let advanceDeducted = 0;
      const advanceDeductions: { advanceId: string; amount: number }[] = [];

      for (const line of record.lines) {
        if (BPJS_EMPLOYEE_CODES.includes(line.componentCode)) {
          bpjsEmployee += line.amount;
        } else if (BPJS_EMPLOYER_CODES.includes(line.componentCode)) {
          bpjsEmployer += line.amount;
        } else if (line.componentCode.startsWith(ADVANCE_CODE_PREFIX)) {
          const advanceId = line.componentCode.slice(
            ADVANCE_CODE_PREFIX.length,
          );
          advanceDeducted += line.amount;
          advanceDeductions.push({ advanceId, amount: line.amount });
        }
      }

      return {
        id: record.id,
        userId: record.userId,
        basicSalary: record.basicSalary,
        totalEarnings: record.totalEarnings,
        totalDeductions: record.totalDeductions,
        totalTax: record.totalTax,
        netSalary: record.netSalary,
        employerCost: record.employerCost,
        bpjsEmployee,
        bpjsEmployer,
        advanceDeducted,
        advanceDeductions,
      };
    });
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<PayrollEntryWithLines | null> {
    const record = await prisma.payrollEntry.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return record ? this.toEntityWithLines(record) : null;
  }

  async findByUserId(
    userId: string,
    tenantId: string,
  ): Promise<PayrollEntry[]> {
    const records = await prisma.payrollEntry.findMany({
      where: {
        userId,
        tenantId,
        payrollRun: {
          status: { in: ["APPROVED", "PAID", "CLOSED"] },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        payrollRun: {
          select: { periodStart: true, periodEnd: true, payDate: true },
        },
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByRunId(runId: string, tenantId: string): Promise<PayrollEntry[]> {
    const records = await prisma.payrollEntry.findMany({
      where: { payrollRunId: runId, tenantId },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByUserAndRun(
    userId: string,
    runId: string,
    tenantId: string,
  ): Promise<PayrollEntryWithLines | null> {
    const record = await prisma.payrollEntry.findFirst({
      where: { userId, payrollRunId: runId, tenantId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return record ? this.toEntityWithLines(record) : null;
  }

  async create(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollEntry> {
    const record = await prisma.payrollEntry.create({ data });
    return this.toEntity(record);
  }

  async createMany(
    data: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">[],
  ): Promise<PayrollEntry[]> {
    if (data.length === 0) return [];

    // Use transaction to ensure atomicity
    const records = await prisma.$transaction(
      data.map((entry) => prisma.payrollEntry.create({ data: entry })),
    );
    return records.map((r) => this.toEntity(r));
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<PayrollEntry>,
  ): Promise<PayrollEntry> {
    const existing = await prisma.payrollEntry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prisma.payrollEntry.update({
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
    const existing = await prisma.payrollEntry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    const record = await prisma.payrollEntry.update({
      where: { id },
      data: { status, errorMessage: errorMessage ?? null },
    });
    return this.toEntity(record);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await prisma.payrollEntry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollEntry not found: ${id}`);
    }

    await prisma.payrollEntry.delete({ where: { id } });
  }

  async deleteByRunId(runId: string, tenantId: string): Promise<void> {
    await prisma.payrollEntry.deleteMany({
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
      await tx.payrollLine.deleteMany({ where: { entryId, tenantId } });
      const created = await Promise.all(
        lines.map((line) =>
          tx.payrollLine.create({
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
    await prisma.payrollLine.deleteMany({ where: { entryId, tenantId } });
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
