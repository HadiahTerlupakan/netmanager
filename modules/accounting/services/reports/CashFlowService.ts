import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type { CashFlowReport, ReportSectionAccount } from "../../dto/ReportDto";

interface RawRow {
  coa_code: string;
  coa_name: string;
  cash_flow_category: string;
  total_debit: string;
  total_credit: string;
}

export class CashFlowService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<CashFlowReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const beforeFrom = new Date(`${from}T00:00:00.000Z`);
    beforeFrom.setDate(beforeFrom.getDate() - 1);

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        coa."cashFlowCategory"::text AS cash_flow_category,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" >= ${fromDate}
        AND je."entryDate" <= ${toDate}
        AND coa."cashFlowCategory" IS NOT NULL
      GROUP BY coa.code, coa.name, coa."cashFlowCategory"
      ORDER BY coa.code ASC
    `;

    const operatingAccounts: ReportSectionAccount[] = [];
    const investingAccounts: ReportSectionAccount[] = [];
    const financingAccounts: ReportSectionAccount[] = [];

    for (const row of rows) {
      const debit = Money.fromString(row.total_debit);
      const credit = Money.fromString(row.total_credit);
      const netFlow = debit.subtract(credit);

      const account: ReportSectionAccount = {
        coaCode: row.coa_code,
        coaName: row.coa_name,
        amount: netFlow.toString(),
      };

      if (row.cash_flow_category === "OPERATING")
        operatingAccounts.push(account);
      else if (row.cash_flow_category === "INVESTING")
        investingAccounts.push(account);
      else if (row.cash_flow_category === "FINANCING")
        financingAccounts.push(account);
    }

    const sumSection = (accounts: ReportSectionAccount[]) =>
      accounts.reduce(
        (acc, a) => acc.add(Money.fromString(a.amount)),
        Money.zero(),
      );

    const operatingTotal = sumSection(operatingAccounts);
    const investingTotal = sumSection(investingAccounts);
    const financingTotal = sumSection(financingAccounts);
    const netChange = operatingTotal.add(investingTotal).add(financingTotal);

    const openingCash = await this.getOpeningCash(tenantId, beforeFrom);
    const closingCash = openingCash.add(netChange);

    return {
      from,
      to,
      operating: {
        label: "Aktivitas Operasi",
        accounts: operatingAccounts,
        subtotal: operatingTotal.toString(),
      },
      investing: {
        label: "Aktivitas Investasi",
        accounts: investingAccounts,
        subtotal: investingTotal.toString(),
      },
      financing: {
        label: "Aktivitas Pendanaan",
        accounts: financingAccounts,
        subtotal: financingTotal.toString(),
      },
      netChange: netChange.toString(),
      openingCash: openingCash.toString(),
      closingCash: closingCash.toString(),
    };
  }

  private async getOpeningCash(
    tenantId: string,
    beforeDate: Date,
  ): Promise<Money> {
    const result = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(
        SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE -jl.amount END), 0
      )::text AS total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" <= ${beforeDate}
        AND coa.type = 'ASSET'
        AND coa.subtype IN ('CURRENT_ASSET')
        AND coa."cashFlowCategory" = 'OPERATING'
    `;
    return Money.fromString(result[0]?.total ?? "0");
  }
}
