import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  ProfitLossReport,
  ProfitLossSection,
  ReportSectionAccount,
} from "../../dto/ReportDto";

interface RawRow {
  coa_code: string;
  coa_name: string;
  coa_type: string;
  total_debit: string;
  total_credit: string;
}

export class ProfitLossService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<ProfitLossReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        coa.type::text AS coa_type,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
        AND coa.type IN ('REVENUE', 'EXPENSE')
      GROUP BY coa.code, coa.name, coa.type
      ORDER BY coa.code ASC
    `;

    const revenueAccounts: ReportSectionAccount[] = [];
    const expenseAccounts: ReportSectionAccount[] = [];

    for (const row of rows) {
      const debit = Money.fromString(row.total_debit);
      const credit = Money.fromString(row.total_credit);
      const amount =
        row.coa_type === "REVENUE"
          ? credit.subtract(debit)
          : debit.subtract(credit);

      const account: ReportSectionAccount = {
        coaCode: row.coa_code,
        coaName: row.coa_name,
        amount: amount.toString(),
      };

      if (row.coa_type === "REVENUE") {
        revenueAccounts.push(account);
      } else {
        expenseAccounts.push(account);
      }
    }

    const revenueTotal = revenueAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );
    const expenseTotal = expenseAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );

    const revenue: ProfitLossSection = {
      label: "Pendapatan",
      accounts: revenueAccounts,
      subtotal: revenueTotal.toString(),
    };

    const expense: ProfitLossSection = {
      label: "Beban",
      accounts: expenseAccounts,
      subtotal: expenseTotal.toString(),
    };

    return {
      from,
      to,
      revenue,
      expense,
      netIncome: revenueTotal.subtract(expenseTotal).toString(),
    };
  }
}
