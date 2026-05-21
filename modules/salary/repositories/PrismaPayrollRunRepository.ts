import { prisma } from "@/lib/prisma";
import type {
  IPayrollRunRepository,
  PayrollRunFilter,
  PayrollRun,
  PayrollRunStatus,
} from "@/modules/salary/core";

/**
 * Prisma implementation of IPayrollRunRepository.
 * Handles CRUD operations for payroll runs with tenant isolation.
 */
export class PrismaPayrollRunRepository implements IPayrollRunRepository {
  async findById(id: string, tenantId: string): Promise<PayrollRun | null> {
    const record = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findAll(filter: PayrollRunFilter): Promise<PayrollRun[]> {
    const records = await prisma.payrollRun.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.scheduleId && { scheduleId: filter.scheduleId }),
        ...(filter.type && { type: filter.type }),
        ...(filter.status && { status: filter.status }),
        ...(filter.periodStart && { periodStart: { gte: filter.periodStart } }),
        ...(filter.periodEnd && { periodEnd: { lte: filter.periodEnd } }),
      },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(
    data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollRun> {
    const record = await prisma.payrollRun.create({ data });
    return this.toEntity(record);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<PayrollRun>,
  ): Promise<PayrollRun> {
    // Ensure tenant isolation by verifying ownership first
    const existing = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollRun not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prisma.payrollRun.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: PayrollRunStatus,
  ): Promise<PayrollRun> {
    const existing = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollRun not found: ${id}`);
    }

    const record = await prisma.payrollRun.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(record);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollRun not found: ${id}`);
    }

    await prisma.payrollRun.delete({ where: { id } });
  }

  private toEntity(record: {
    id: string;
    tenantId: string;
    scheduleId: string;
    type: string;
    status: string;
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    totalEntries: number;
    totalNetSalary: number;
    totalEmployerCost: number;
    lockedAt: Date | null;
    lockedBy: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): PayrollRun {
    return {
      id: record.id,
      tenantId: record.tenantId,
      scheduleId: record.scheduleId,
      type: record.type as PayrollRun["type"],
      status: record.status as PayrollRun["status"],
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      payDate: record.payDate,
      totalEntries: record.totalEntries,
      totalNetSalary: record.totalNetSalary,
      totalEmployerCost: record.totalEmployerCost,
      lockedAt: record.lockedAt,
      lockedBy: record.lockedBy,
      notes: record.notes,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
