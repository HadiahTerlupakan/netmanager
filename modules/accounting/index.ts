export { ChartOfAccountService } from "./services/coa/ChartOfAccountService";
export { JournalPostingService } from "./services/journal/JournalPostingService";
export { JournalNumberGenerator } from "./services/journal/JournalNumberGenerator";
export { JournalReverseService } from "./services/journal/JournalReverseService";
export { OpeningBalanceService } from "./services/journal/OpeningBalanceService";
export { PeriodService } from "./services/period/PeriodService";
export { PeriodCloseService } from "./services/period/PeriodCloseService";
export { RecurringEngineService } from "./services/recurring/RecurringEngineService";
export { RecurringService } from "./services/recurring/RecurringService";

export { ChartOfAccountRepository } from "./repositories/ChartOfAccountRepository";
export { JournalRepository } from "./repositories/JournalRepository";
export { PeriodRepository } from "./repositories/PeriodRepository";
export { RecurringRepository } from "./repositories/RecurringRepository";
export { ReconciliationRepository } from "./repositories/ReconciliationRepository";
export { BankReconciliationService } from "./services/reconciliation/BankReconciliationService";
export { runAccountingHealthCheck } from "./services/health-check";

export type {
  ChartOfAccount,
  COAType,
  DebitCredit,
} from "./domain/entities/ChartOfAccount";
export type {
  JournalEntry,
  JournalSource,
  JournalStatus,
} from "./domain/entities/JournalEntry";
export type {
  JournalLine,
  JournalLineDraft,
} from "./domain/entities/JournalLine";
export type {
  AccountingPeriod,
  PeriodStatus,
} from "./domain/entities/AccountingPeriod";
export { isPeriodWritable } from "./domain/entities/AccountingPeriod";

export { Money } from "./domain/value-objects/Money";

export {
  createManualJournalSchema,
  journalListQuerySchema,
} from "./validators/journal";

export {
  asOfDateSchema,
  dateRangeSchema,
  ledgerQuerySchema,
} from "./validators/reports";

export {
  reverseJournalSchema,
  openingBalanceSchema,
} from "./validators/period";

export {
  createRecurringSchema,
  updateRecurringSchema,
} from "./validators/recurring";

export {
  createReconciliationSchema,
  manualMatchSchema,
} from "./validators/reconciliation";

export { toJournalResponseDto } from "./dto/JournalDto";
export type {
  JournalResponseDto,
  JournalListResponseDto,
} from "./dto/JournalDto";

export {
  AccountingError,
  JournalUnbalancedError,
  PeriodClosedError,
  CoaNotFoundError,
  CoaNotPostableError,
  JournalAlreadyReversedError,
  DuplicateJournalSourceError,
} from "./errors";

// Report Services
export { TrialBalanceService } from "./services/reports/TrialBalanceService";
export { ProfitLossService } from "./services/reports/ProfitLossService";
export { BalanceSheetService } from "./services/reports/BalanceSheetService";
export { CashFlowService } from "./services/reports/CashFlowService";
export { CashBookService } from "./services/reports/CashBookService";
export { GeneralLedgerService } from "./services/reports/GeneralLedgerService";

// Report factory (pre-injected prisma for API routes)
import { prisma } from "@/lib/prisma";
import { TrialBalanceService } from "./services/reports/TrialBalanceService";
import { ProfitLossService } from "./services/reports/ProfitLossService";
import { BalanceSheetService } from "./services/reports/BalanceSheetService";
import { CashFlowService } from "./services/reports/CashFlowService";
import { CashBookService } from "./services/reports/CashBookService";
import { GeneralLedgerService } from "./services/reports/GeneralLedgerService";

export function getTrialBalanceService() {
  return new TrialBalanceService(prisma);
}
export function getProfitLossService() {
  return new ProfitLossService(prisma);
}
export function getBalanceSheetService() {
  return new BalanceSheetService(prisma);
}
export function getCashFlowService() {
  return new CashFlowService(prisma);
}
export function getCashBookService() {
  return new CashBookService(prisma);
}
export function getGeneralLedgerService() {
  return new GeneralLedgerService(prisma);
}

// Report DTOs
export type {
  TrialBalanceReport,
  ProfitLossReport,
  BalanceSheetReport,
  CashFlowReport,
  CashBookReport,
  GeneralLedgerReport,
} from "./dto/ReportDto";

export { handleInvoiceCreatedAccounting } from "./services/event-handlers/invoice-created-accounting.handler";
export { handleInvoicePaidAccounting } from "./services/event-handlers/invoice-paid-accounting.handler";
export { handleExpenseApprovedAccounting } from "./services/event-handlers/expense-approved-accounting.handler";
export { handlePurchaseOrderPaidAccounting } from "./services/event-handlers/purchase-order-paid-accounting.handler";
