import { prisma } from "@/lib/prisma";
import type {
  IChartOfAccountRepository,
  CoaCreateInput,
  CoaUpdateInput,
} from "../domain/ports/IChartOfAccountRepository";
import type {
  ChartOfAccount,
  COAType,
} from "../domain/entities/ChartOfAccount";
import { toChartOfAccount } from "../mappers/coa.mapper";

export class ChartOfAccountRepository implements IChartOfAccountRepository {
  async create(input: CoaCreateInput): Promise<ChartOfAccount> {
    const row = await prisma.chartOfAccount.create({
      data: {
        tenantId: input.tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        subtype: input.subtype ?? null,
        normalSide: input.normalSide,
        cashFlowCategory: input.cashFlowCategory ?? null,
        parentId: input.parentId ?? null,
        isPostable: input.isPostable ?? true,
        isSystem: input.isSystem ?? false,
        description: input.description ?? null,
      },
    });
    return toChartOfAccount(row);
  }

  async update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount> {
    const row = await prisma.chartOfAccount.update({
      where: { id },
      data: {
        name: input.name,
        subtype: input.subtype,
        cashFlowCategory: input.cashFlowCategory,
        parentId: input.parentId,
        isActive: input.isActive,
        description: input.description,
      },
    });
    return toChartOfAccount(row);
  }

  async findById(id: string): Promise<ChartOfAccount | null> {
    const row = await prisma.chartOfAccount.findUnique({ where: { id } });
    return row ? toChartOfAccount(row) : null;
  }

  async findByCode(
    tenantId: string,
    code: string,
  ): Promise<ChartOfAccount | null> {
    const row = await prisma.chartOfAccount.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    return row ? toChartOfAccount(row) : null;
  }

  async list(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccount[]> {
    const rows = await prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        ...(filter?.type && { type: filter.type }),
        ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      },
      orderBy: { code: "asc" },
    });
    return rows.map(toChartOfAccount);
  }

  async delete(id: string): Promise<void> {
    await prisma.chartOfAccount.delete({ where: { id } });
  }

  async countChildren(parentId: string): Promise<number> {
    return prisma.chartOfAccount.count({ where: { parentId } });
  }

  async countLines(coaId: string): Promise<number> {
    return prisma.journalLine.count({ where: { coaId } });
  }
}
