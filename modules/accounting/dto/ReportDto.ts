import type { COAType, DebitCredit } from "../domain/entities/ChartOfAccount";

export interface TrialBalanceRow {
  coaCode: string;
  coaName: string;
  coaType: COAType;
  totalDebit: string;
  totalCredit: string;
  balance: string;
  normalSide: DebitCredit;
}

export interface TrialBalanceReport {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export interface ReportSectionAccount {
  coaCode: string;
  coaName: string;
  amount: string;
}

export interface ProfitLossSection {
  label: string;
  accounts: ReportSectionAccount[];
  subtotal: string;
}

export interface ProfitLossReport {
  from: string;
  to: string;
  revenue: ProfitLossSection;
  expense: ProfitLossSection;
  netIncome: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  asset: ProfitLossSection;
  liability: ProfitLossSection;
  equity: ProfitLossSection;
  totalAsset: string;
  totalLiabilityEquity: string;
  balanced: boolean;
}

export interface CashFlowReport {
  from: string;
  to: string;
  operating: ProfitLossSection;
  investing: ProfitLossSection;
  financing: ProfitLossSection;
  netChange: string;
  openingCash: string;
  closingCash: string;
}

export interface CashBookEntry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface CashBookReport {
  coaId: string;
  coaCode: string;
  coaName: string;
  from: string;
  to: string;
  openingBalance: string;
  entries: CashBookEntry[];
  closingBalance: string;
}

export interface GeneralLedgerEntry {
  date: string;
  entryNumber: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface GeneralLedgerReport {
  coaId: string;
  coaCode: string;
  coaName: string;
  coaType: COAType;
  normalSide: DebitCredit;
  from: string;
  to: string;
  openingBalance: string;
  entries: GeneralLedgerEntry[];
  closingBalance: string;
}
