import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  GeneralLedgerReport,
  GeneralLedgerEntry,
} from "../../dto/ReportDto";
import type {
  COAType,
  DebitCredit,
} from "../../domain/entities/ChartOfAccount";

interface RawEntry {
  entry_date: Date;
  entry_number: string;
  description: string;
  side: string;
  amount: string;
}

export class GeneralLedgerService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    coaId: string,
    from: string,
    to: string,
  ): Promise<GeneralLedgerReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const beforeFrom = new Date(`${from}T00:00:00.000Z`);
    beforeFrom.setMilliseconds(beforeFrom.getMilliseconds() - 1);

    const coa = await this.prisma.chartOfAccount.findUnique({
      where: { id: coaId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalSide: true,
      },
    });
    if (!coa) throw new Error(`COA ${coaId} not found`);

    const isDebitNormal = coa.normalSide === "DEBIT";
    const openingBalance = await this.getOpeningBalance(
      tenantId,
      coaId,
      beforeFrom,
      isDebitNormal,
    );

    const entries = await this.prisma.$queryRaw<RawEntry[]>`
      SELECT
        je."entryDate" AS entry_date,
        je."entryNumber" AS entry_number,
        je.description,
        jl.side::text AS side,
        jl.amount::text AS amount
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND jl."coaId" = ${coaId}
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
      ORDER BY je."entryDate" ASC, je."entryNumber" ASC
    `;

    let running = openingBalance;
    const ledgerEntries: GeneralLedgerEntry[] = entries.map((e) => {
      const amount = Money.fromString(e.amount);
      const debit = e.side === "DEBIT" ? amount.toString() : "0.00";
      const credit = e.side === "CREDIT" ? amount.toString() : "0.00";

      if (isDebitNormal) {
        running =
          e.side === "DEBIT" ? running.add(amount) : running.subtract(amount);
      } else {
        running =
          e.side === "CREDIT" ? running.add(amount) : running.subtract(amount);
      }

      return {
        date: e.entry_date.toISOString().split("T")[0],
        entryNumber: e.entry_number,
        description: e.description,
        debit,
        credit,
        runningBalance: running.toString(),
      };
    });

    return {
      coaId: coa.id,
      coaCode: coa.code,
      coaName: coa.name,
      coaType: coa.type as COAType,
      normalSide: coa.normalSide as DebitCredit,
      from,
      to,
      openingBalance: openingBalance.toString(),
      entries: ledgerEntries,
      closingBalance: running.toString(),
    };
  }

  private async getOpeningBalance(
    tenantId: string,
    coaId: string,
    beforeDate: Date,
    isDebitNormal: boolean,
  ): Promise<Money> {
    const result = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(
        SUM(CASE
          WHEN jl.side = ${isDebitNormal ? "DEBIT" : "CREDIT"} THEN jl.amount
          ELSE -jl.amount
        END), 0
      )::text AS total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND jl."coaId" = ${coaId}
        AND je."entryDate" <= ${beforeDate}
    `;
    return Money.fromString(result[0]?.total ?? "0");
  }
}
