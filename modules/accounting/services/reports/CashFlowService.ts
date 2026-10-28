import type { PrismaClient } from "@prisma/client";
import { Money } from "../../Money";
import type { CashFlowReport, ReportSectionAccount } from "../../dto/ReportDto";
import { cashCoaIdsSql } from "./cash-accounts";

interface RawRow {
  coa_code: string;
  coa_name: string;
  coa_type: string;
  cash_flow_category: string | null;
  cash_in: string;
}

// Setoran dan pengembalian dana investor dicatat di Hutang Investor.
const FINANCING_LIABILITY_CODES = new Set(["2-600"]);

/**
 * Kategori aktivitas akun lawan. Akun tanpa kategori (Piutang, Pendapatan,
 * Utang usaha) termasuk operasi; modal dan dana investor termasuk pendanaan.
 */
function sectionOf(row: RawRow) {
  if (row.cash_flow_category) return row.cash_flow_category;
  if (
    row.coa_type === "EQUITY" ||
    FINANCING_LIABILITY_CODES.has(row.coa_code)
  ) {
    return "FINANCING";
  }
  return "OPERATING";
}

/**
 * Arus kas metode langsung: mutasi akun kas dalam periode, dikelompokkan
 * menurut akun lawannya sebagai asal-usul (Piutang Usaha = penerimaan
 * pelanggan, Beban Gaji = pembayaran gaji, ...). Dalam jurnal yang seimbang,
 * jumlah (kredit - debit) akun lawan sama dengan perubahan kas, jadi tiap
 * akun lawan mendapat bagian yang tepat. Pindah dana antar akun kas
 * (pencairan gateway ke bank) tidak punya akun lawan dan tidak terhitung.
 *
 * Dulu laporan ini menjumlah debit - kredit pada akun bertanda kategori
 * (hanya beban dan aset tetap), sehingga penerimaan pelanggan tidak pernah
 * muncul dan beban tampil sebagai arus positif.
 */
export class CashFlowService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<CashFlowReport> {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      WITH cash_coa AS (${cashCoaIdsSql(tenantId)}),
      cash_entries AS (
        SELECT DISTINCT je.id
        FROM journal_entries je
        JOIN journal_lines jl ON jl."entryId" = je.id
        WHERE je."tenantId" = ${tenantId}
          AND je.status = 'POSTED'
          AND je."entryDate" >= ${fromDate}
          AND je."entryDate" <= ${toDate}
          AND jl."coaId" IN (SELECT id FROM cash_coa)
      )
      SELECT
        coa.code AS coa_code,
        coa.name AS coa_name,
        coa.type::text AS coa_type,
        coa."cashFlowCategory"::text AS cash_flow_category,
        SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE -jl.amount END)::text AS cash_in
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE jl."entryId" IN (SELECT id FROM cash_entries)
        AND jl."coaId" NOT IN (SELECT id FROM cash_coa)
      GROUP BY coa.code, coa.name, coa.type, coa."cashFlowCategory"
      ORDER BY coa.code ASC
    `;

    const operatingAccounts: ReportSectionAccount[] = [];
    const investingAccounts: ReportSectionAccount[] = [];
    const financingAccounts: ReportSectionAccount[] = [];

    for (const row of rows) {
      const account: ReportSectionAccount = {
        coaCode: row.coa_code,
        coaName: row.coa_name,
        amount: Money.fromString(row.cash_in).toString(),
      };

      const section = sectionOf(row);
      if (section === "INVESTING") investingAccounts.push(account);
      else if (section === "FINANCING") financingAccounts.push(account);
      else operatingAccounts.push(account);
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

    const openingCash = await this.getOpeningCash(tenantId, fromDate);
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

  /** Saldo seluruh akun kas sebelum awal periode. */
  private async getOpeningCash(
    tenantId: string,
    fromDate: Date,
  ): Promise<Money> {
    const result = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(
        SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE -jl.amount END), 0
      )::text AS total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND je."entryDate" < ${fromDate}
        AND jl."coaId" IN (${cashCoaIdsSql(tenantId)})
    `;
    return Money.fromString(result[0]?.total ?? "0");
  }
}
