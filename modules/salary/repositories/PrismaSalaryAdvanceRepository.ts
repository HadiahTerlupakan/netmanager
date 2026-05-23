import { prisma } from "@/lib/prisma";
import type {
  ISalaryAdvanceRepository,
  AdvanceFilter,
  SalaryAdvance,
  SalaryAdvanceStatus,
} from "@/modules/salary/core";

export class PrismaSalaryAdvanceRepository implements ISalaryAdvanceRepository {
  async findById(id: string, tenantId: string): Promise<SalaryAdvance | null> {
    const record = await prisma.salaryAdvance.findFirst({
      where: { id, tenantId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findActiveByUser(
    userId: string,
    tenantId: string,
  ): Promise<SalaryAdvance[]> {
    const records = await prisma.salaryAdvance.findMany({
      where: {
        tenantId,
        userId,
        status: { in: ["PENDING", "APPROVED", "DISBURSED"] },
      },
      orderBy: { requestDate: "desc" },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findAll(filter: AdvanceFilter): Promise<SalaryAdvance[]> {
    const records = await prisma.salaryAdvance.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.userId && { userId: filter.userId }),
        ...(filter.status && { status: filter.status }),
      },
      orderBy: { requestDate: "desc" },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(
    data: Omit<SalaryAdvance, "id" | "createdAt" | "updatedAt">,
  ): Promise<SalaryAdvance> {
    const record = await prisma.salaryAdvance.create({ data });
    return this.toEntity(record);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<SalaryAdvance>,
  ): Promise<SalaryAdvance> {
    const existing = await prisma.salaryAdvance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`SalaryAdvance not found: ${id}`);
    }

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updateData } = data;
    const record = await prisma.salaryAdvance.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: SalaryAdvanceStatus,
  ): Promise<SalaryAdvance> {
    const existing = await prisma.salaryAdvance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error(`SalaryAdvance not found: ${id}`);
    }

    const record = await prisma.salaryAdvance.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(record);
  }

  async countActive(userId: string, tenantId: string): Promise<number> {
    return prisma.salaryAdvance.count({
      where: {
        tenantId,
        userId,
        status: { in: ["PENDING", "APPROVED", "DISBURSED"] },
      },
    });
  }

  private toEntity(record: {
    id: string;
    tenantId: string;
    userId: string;
    amount: number;
    requestDate: Date;
    approvedBy: string | null;
    approvedAt: Date | null;
    status: string;
    deductionMethod: string;
    installmentCount: number | null;
    remainingAmount: number;
    reason: string | null;
    rejectionReason: string | null;
    disbursedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SalaryAdvance {
    return {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      amount: record.amount,
      requestDate: record.requestDate,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
      status: record.status as SalaryAdvanceStatus,
      deductionMethod:
        record.deductionMethod as SalaryAdvance["deductionMethod"],
      installmentCount: record.installmentCount,
      remainingAmount: record.remainingAmount,
      reason: record.reason,
      rejectionReason: record.rejectionReason,
      disbursedAt: record.disbursedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
