import { prisma } from "@/lib/prisma";
import type {
  IChartOfAccountRepository,
  CoaCreateInput,
  CoaUpdateInput,
  AccountBalanceRow,
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

  async deleteSystemAccounts(tenantId: string): Promise<void> {
    await prisma.chartOfAccount.deleteMany({
      where: { tenantId, isSystem: true },
    });
  }

  async countChildren(parentId: string): Promise<number> {
    return prisma.chartOfAccount.count({ where: { parentId } });
  }

  async countLines(coaId: string): Promise<number> {
    return prisma.journalLine.count({ where: { coaId } });
  }

  async getAccountBalances(
    tenantId: string,
    coaIds: string[],
  ): Promise<AccountBalanceRow[]> {
    if (coaIds.length === 0) return [];
    const rows = await prisma.$queryRaw<
      { coaId: string; side: string; total: string }[]
    >`
      SELECT jl."coaId" as "coaId", jl.side::text as side, COALESCE(SUM(jl.amount), 0)::text as total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND jl."coaId" = ANY(${coaIds})
      GROUP BY jl."coaId", jl.side
    `;
    return rows.map((row) => ({
      coaId: row.coaId,
      side: row.side as "DEBIT" | "CREDIT",
      total: Number(row.total),
    }));
  }
}
