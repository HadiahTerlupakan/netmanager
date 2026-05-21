import type { PrismaClient } from "@prisma/client";
import { Money } from "../../Money";
import type { TrialBalanceReport, TrialBalanceRow } from "../../dto/ReportDto";
import type {
  COAType,
  DebitCredit,
} from "../../domain/entities/ChartOfAccount";

interface RawRow {
  coa_code: string;
  coa_name: string;
  coa_type: COAType;
  normal_side: DebitCredit;
  total_debit: string;
  total_credit: string;
}

export class TrialBalanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    asOfDate: string,
    fromDate?: string,
  ): Promise<TrialBalanceReport> {
    const asOf = new Date(`${asOfDate}T23:59:59.999Z`);
    const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;

    const rows = from
      ? await this.prisma.$queryRaw<RawRow[]>`
          SELECT
            coa.code AS coa_code,
            coa.name AS coa_name,
            coa.type::text AS coa_type,
            coa."normalSide"::text AS normal_side,
            COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
            COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl."entryId"
          JOIN chart_of_accounts coa ON coa.id = jl."coaId"
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND je."entryDate" >= ${from}
            AND je."entryDate" <= ${asOf}
          GROUP BY coa.code, coa.name, coa.type, coa."normalSide"
          ORDER BY coa.code ASC
        `
      : await this.prisma.$queryRaw<RawRow[]>`
          SELECT
            coa.code AS coa_code,
            coa.name AS coa_name,
            coa.type::text AS coa_type,
            coa."normalSide"::text AS normal_side,
            COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
            COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl."entryId"
          JOIN chart_of_accounts coa ON coa.id = jl."coaId"
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND je."entryDate" <= ${asOf}
          GROUP BY coa.code, coa.name, coa.type, coa."normalSide"
          ORDER BY coa.code ASC
        `;

    const tbRows: TrialBalanceRow[] = rows.map((r) => {
      const debit = Money.fromString(r.total_debit);
      const credit = Money.fromString(r.total_credit);
      const balance =
        r.coa_type === "ASSET" || r.coa_type === "EXPENSE"
          ? debit.subtract(credit)
          : credit.subtract(debit);
      return {
        coaCode: r.coa_code,
        coaName: r.coa_name,
        coaType: r.coa_type,
        totalDebit: debit.toString(),
        totalCredit: credit.toString(),
        balance: balance.toString(),
        normalSide: r.normal_side,
      };
    });

    const totalDebit = tbRows.reduce(
      (acc, r) => acc.add(Money.fromString(r.totalDebit)),
      Money.zero(),
    );
    const totalCredit = tbRows.reduce(
      (acc, r) => acc.add(Money.fromString(r.totalCredit)),
      Money.zero(),
    );

    return {
      asOfDate,
      rows: tbRows,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      balanced: totalDebit.equals(totalCredit),
    };
  }
}
