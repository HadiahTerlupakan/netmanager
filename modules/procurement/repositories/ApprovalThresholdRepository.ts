import { prisma } from "@/lib/prisma";
import type {
  ApprovalThreshold,
  ApprovalThresholdScope,
} from "../domain/entities/ApprovalThreshold";
import type {
  ApprovalThresholdCreateInput,
  ApprovalThresholdListFilter,
  ApprovalThresholdUpdateInput,
  ApprovalThresholdWithRole,
  IApprovalThresholdRepository,
} from "../domain/ports/IApprovalThresholdRepository";

interface ApprovalThresholdRow {
  id: string;
  scope: string;
  roleId: string;
  minAmount: number;
  maxAmount: number | null;
  description: string | null;
  isActive: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapEntity(row: ApprovalThresholdRow): ApprovalThreshold {
  return {
    id: row.id,
    scope: row.scope as ApprovalThresholdScope,
    roleId: row.roleId,
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    description: row.description,
    isActive: row.isActive,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ApprovalThresholdRepository implements IApprovalThresholdRepository {
  async create(
    input: ApprovalThresholdCreateInput,
  ): Promise<ApprovalThreshold> {
    const row = await prisma.approvalThreshold.create({
      data: {
        scope: input.scope,
        roleId: input.roleId,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        tenantId: input.tenantId,
      },
    });
    return mapEntity(row);
  }

  async update(
    id: string,
    input: ApprovalThresholdUpdateInput,
  ): Promise<ApprovalThreshold> {
    const row = await prisma.approvalThreshold.update({
      where: { id },
      data: {
        ...(input.minAmount !== undefined && { minAmount: input.minAmount }),
        ...(input.maxAmount !== undefined && { maxAmount: input.maxAmount }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return mapEntity(row);
  }

  async findById(id: string): Promise<ApprovalThreshold | null> {
    const row = await prisma.approvalThreshold.findUnique({ where: { id } });
    return row ? mapEntity(row) : null;
  }

  async list(
    filter: ApprovalThresholdListFilter,
  ): Promise<ApprovalThresholdWithRole[]> {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.scope) where.scope = filter.scope;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.roleId) where.roleId = filter.roleId;

    const rows = await prisma.approvalThreshold.findMany({
      where,
      orderBy: [{ scope: "asc" }, { minAmount: "asc" }],
      include: {
        role: { select: { id: true, name: true } },
      },
    });

    return rows.map((row) => ({
      ...mapEntity(row),
      role: row.role ? { id: row.role.id, name: row.role.name } : null,
    }));
  }

  async delete(id: string): Promise<void> {
    await prisma.approvalThreshold.delete({ where: { id } });
  }

  async findCoveringThreshold(input: {
    tenantId: string | null;
    scope: ApprovalThresholdScope;
    amount: number;
    roleIds: string[];
  }): Promise<ApprovalThreshold | null> {
    if (input.roleIds.length === 0) return null;
    const row = await prisma.approvalThreshold.findFirst({
      where: {
        tenantId: input.tenantId,
        scope: input.scope,
        isActive: true,
        roleId: { in: input.roleIds },
        minAmount: { lte: input.amount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: input.amount } }],
      },
      orderBy: { minAmount: "desc" },
    });
    return row ? mapEntity(row) : null;
  }
}
