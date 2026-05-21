import { prisma } from "@/lib/prisma";
import type { TaxType } from "../domain/entities/TaxConfig";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";
import type {
  ITaxTransactionRepository,
  TaxTransactionCreateInput,
  TaxTransactionListFilter,
  TaxTransactionListResult,
} from "../domain/ports/ITaxTransactionRepository";

/** Maps Prisma TaxTransaction row to domain entity (Decimal → number) */
function toDomain(row: {
  id: string;
  tenantId: string;
  taxType: string;
  direction: string;
  amount: unknown;
  taxAmount: unknown;
  rate: unknown;
  sourceRefType: string;
  sourceRefId: string;
  periodYear: number;
  periodMonth: number;
  journalId: string | null;
  notes: string | null;
  createdAt: Date;
}): TaxTransaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    taxType: row.taxType as TaxType,
    direction: row.direction as TaxTransaction["direction"],
    amount: Number(row.amount),
    taxAmount: Number(row.taxAmount),
    rate: Number(row.rate),
    sourceRefType: row.sourceRefType,
    sourceRefId: row.sourceRefId,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    journalId: row.journalId,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export class TaxTransactionRepository implements ITaxTransactionRepository {
  async create(input: TaxTransactionCreateInput): Promise<TaxTransaction> {
    const row = await prisma.taxTransaction.create({
      data: {
        tenantId: input.tenantId,
        taxType: input.taxType,
        direction: input.direction,
        amount: input.amount,
        taxAmount: input.taxAmount,
        rate: input.rate,
        sourceRefType: input.sourceRefType,
        sourceRefId: input.sourceRefId,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        journalId: input.journalId ?? null,
        notes: input.notes ?? null,
      },
    });
    return toDomain(row);
  }

  async findBySource(
    tenantId: string,
    sourceRefType: string,
    sourceRefId: string,
    taxType: TaxType,
  ): Promise<TaxTransaction | null> {
    const row = await prisma.taxTransaction.findUnique({
      where: {
        tenantId_sourceRefType_sourceRefId_taxType: {
          tenantId,
          sourceRefType,
          sourceRefId,
          taxType,
        },
      },
    });
    return row ? toDomain(row) : null;
  }

  async findByPeriod(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxTransaction[]> {
    const rows = await prisma.taxTransaction.findMany({
      where: { tenantId, periodYear: year, periodMonth: month },
    });
    return rows.map(toDomain);
  }

  async list(
    filter: TaxTransactionListFilter,
  ): Promise<TaxTransactionListResult> {
    const where: Record<string, unknown> = {
      tenantId: filter.tenantId,
      periodYear: filter.year,
    };

    if (filter.month) {
      where.periodMonth = filter.month;
    }

    if (filter.taxType) {
      where.taxType = filter.taxType;
    }

    const [rows, total] = await Promise.all([
      prisma.taxTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.taxTransaction.count({ where }),
    ]);

    return {
      items: rows.map(toDomain),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }
}
