import type { PrismaClient } from "@prisma/client";
import { Money } from "../../domain/value-objects/Money";
import type {
  BalanceSheetReport,
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

export class BalanceSheetService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    asOfDate: string,
  ): Promise<BalanceSheetReport> {
    const asOf = new Date(`${asOfDate}T23:59:59.999Z`);

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
        AND je."entryDate" <= ${asOf}
        AND coa.type IN ('ASSET', 'LIABILITY', 'EQUITY')
      GROUP BY coa.code, coa.name, coa.type
      ORDER BY coa.code ASC
    `;

    const assetAccounts: ReportSectionAccount[] = [];
    const liabilityAccounts: ReportSectionAccount[] = [];
    const equityAccounts: ReportSectionAccount[] = [];

    for (const row of rows) {
      const debit = Money.fromString(row.total_debit);
      const credit = Money.fromString(row.total_credit);
      const amount =
        row.coa_type === "ASSET"
          ? debit.subtract(credit)
          : credit.subtract(debit);

      const account: ReportSectionAccount = {
        coaCode: row.coa_code,
        coaName: row.coa_name,
        amount: amount.toString(),
      };

      if (row.coa_type === "ASSET") assetAccounts.push(account);
      else if (row.coa_type === "LIABILITY") liabilityAccounts.push(account);
      else equityAccounts.push(account);
    }

    const totalAsset = assetAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );
    const totalLiability = liabilityAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );
    const totalEquity = equityAccounts.reduce(
      (acc, a) => acc.add(Money.fromString(a.amount)),
      Money.zero(),
    );
    const totalLiabilityEquity = totalLiability.add(totalEquity);

    const asset: ProfitLossSection = {
      label: "Aset",
      accounts: assetAccounts,
      subtotal: totalAsset.toString(),
    };
    const liability: ProfitLossSection = {
      label: "Liabilitas",
      accounts: liabilityAccounts,
      subtotal: totalLiability.toString(),
    };
    const equity: ProfitLossSection = {
      label: "Ekuitas",
      accounts: equityAccounts,
      subtotal: totalEquity.toString(),
    };

    return {
      asOfDate,
      asset,
      liability,
      equity,
      totalAsset: totalAsset.toString(),
      totalLiabilityEquity: totalLiabilityEquity.toString(),
      balanced: totalAsset.equals(totalLiabilityEquity),
    };
  }
}
