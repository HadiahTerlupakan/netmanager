import { prisma } from "@/lib/prisma";
import type {
  IPayrollPeriodRepository,
  PeriodFilter,
  PayrollPeriod,
  PayrollPeriodStatus,
} from "@/modules/salary/core";

export class PrismaPayrollPeriodRepository implements IPayrollPeriodRepository {
  async findById(id: string, tenantId: string): Promise<PayrollPeriod | null> {
    const record = await prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findCurrent(
    scheduleId: string,
    tenantId: string,
  ): Promise<PayrollPeriod | null> {
    const now = new Date();
    const record = await prisma.payrollPeriod.findFirst({
      where: {
        tenantId,
        scheduleId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        status: { in: ["OPEN", "PROCESSING"] },
      },
      orderBy: { periodStart: "desc" },
    });
    return record ? this.toEntity(record) : null;
  }

  async findContainingDate(
    tenantId: string,
    date: Date,
  ): Promise<PayrollPeriod | null> {
    const record = await prisma.payrollPeriod.findFirst({
      where: {
        tenantId,
        periodStart: { lte: date },
        periodEnd: { gte: date },
      },
      orderBy: { periodStart: "desc" },
    });
    return record ? this.toEntity(record) : null;
  }

  async findAll(filter: PeriodFilter): Promise<PayrollPeriod[]> {
    const records = await prisma.payrollPeriod.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.scheduleId && { scheduleId: filter.scheduleId }),
        ...(filter.status && { status: filter.status }),
        ...(filter.fromDate && { periodStart: { gte: filter.fromDate } }),
        ...(filter.toDate && { periodEnd: { lte: filter.toDate } }),
      },
      orderBy: { periodStart: "desc" },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(
    data: Omit<PayrollPeriod, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollPeriod> {
    const record = await prisma.payrollPeriod.create({ data });
    return this.toEntity(record);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<PayrollPeriod>,
  ): Promise<PayrollPeriod> {
    const existing = await prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollPeriod not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prisma.payrollPeriod.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: PayrollPeriodStatus,
  ): Promise<PayrollPeriod> {
    const existing = await prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`PayrollPeriod not found: ${id}`);
    }

    const record = await prisma.payrollPeriod.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(record);
  }

  async checkOverlap(
    scheduleId: string,
    tenantId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const count = await prisma.payrollPeriod.count({
      where: {
        tenantId,
        scheduleId,
        ...(excludeId && { id: { not: excludeId } }),
        OR: [{ periodStart: { lte: end }, periodEnd: { gte: start } }],
      },
    });
    return count > 0;
  }

  private toEntity(record: {
    id: string;
    tenantId: string;
    scheduleId: string;
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    status: string;
    lockedAt: Date | null;
    lockedBy: string | null;
    unlockReason: string | null;
    unlockCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): PayrollPeriod {
    return {
      id: record.id,
      tenantId: record.tenantId,
      scheduleId: record.scheduleId,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      payDate: record.payDate,
      status: record.status as PayrollPeriodStatus,
      lockedAt: record.lockedAt,
      lockedBy: record.lockedBy,
      unlockReason: record.unlockReason,
      unlockCount: record.unlockCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
