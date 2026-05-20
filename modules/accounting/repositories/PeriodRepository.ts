import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { IPeriodRepository } from "../domain/ports/IPeriodRepository";
import type {
  AccountingPeriod,
  PeriodStatus,
} from "../domain/entities/AccountingPeriod";
import { toAccountingPeriod } from "../mappers/period.mapper";

export class PeriodRepository implements IPeriodRepository {
  async findById(id: string): Promise<AccountingPeriod | null> {
    const row = await prisma.accountingPeriod.findUnique({ where: { id } });
    return row ? toAccountingPeriod(row) : null;
  }

  async findByYearMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null> {
    const row = await prisma.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return row ? toAccountingPeriod(row) : null;
  }

  async findByDate(
    tenantId: string,
    date: Date,
  ): Promise<AccountingPeriod | null> {
    const row = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    return row ? toAccountingPeriod(row) : null;
  }

  async create(
    period: Omit<AccountingPeriod, "id">,
  ): Promise<AccountingPeriod> {
    const row = await prisma.accountingPeriod.create({
      data: {
        tenantId: period.tenantId,
        year: period.year,
        month: period.month,
        status: period.status,
        closedAt: period.closedAt,
        closedBy: period.closedBy,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });
    return toAccountingPeriod(row);
  }

  async updateStatus(
    id: string,
    status: PeriodStatus,
    closedBy?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingPeriod> {
    const client = tx ?? prisma;
    const row = await client.accountingPeriod.update({
      where: { id },
      data: {
        status,
        ...(status === "CLOSED" && {
          closedAt: new Date(),
          closedBy: closedBy ?? null,
        }),
      },
    });
    return toAccountingPeriod(row);
  }

  async list(tenantId: string): Promise<AccountingPeriod[]> {
    const rows = await prisma.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map(toAccountingPeriod);
  }

  async lockForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<AccountingPeriod | null> {
    const rows = await tx.$queryRaw<
      {
        id: string;
        tenantId: string;
        year: number;
        month: number;
        status: AccountingPeriod["status"];
        closedAt: Date | null;
        closedBy: string | null;
        startDate: Date;
        endDate: Date;
      }[]
    >`
      SELECT id, "tenantId", year, month, status, "closedAt", "closedBy", "startDate", "endDate"
      FROM accounting_periods WHERE id = ${id} FOR UPDATE
    `;
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      year: row.year,
      month: row.month,
      status: row.status,
      closedAt: row.closedAt,
      closedBy: row.closedBy,
      startDate: row.startDate,
      endDate: row.endDate,
    };
  }
}
