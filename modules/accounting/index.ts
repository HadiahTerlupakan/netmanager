export { ChartOfAccountService } from "./services/coa/ChartOfAccountService";
export { JournalPostingService } from "./services/journal/JournalPostingService";
export { JournalNumberGenerator } from "./services/journal/JournalNumberGenerator";
export { JournalReverseService } from "./services/journal/JournalReverseService";
export { OpeningBalanceService } from "./services/journal/OpeningBalanceService";
export { PeriodService } from "./services/period/PeriodService";
export { PeriodCloseService } from "./services/period/PeriodCloseService";
export { RecurringEngineService } from "./services/recurring/RecurringEngineService";
export { RecurringService } from "./services/recurring/RecurringService";

// Factory functions (pre-wired with repositories)
import { ChartOfAccountRepository } from "./repositories/ChartOfAccountRepository";
import { JournalRepository } from "./repositories/JournalRepository";
import { PeriodRepository } from "./repositories/PeriodRepository";
import { RecurringRepository } from "./repositories/RecurringRepository";
import { ReconciliationRepository } from "./repositories/ReconciliationRepository";
import { ChartOfAccountService } from "./services/coa/ChartOfAccountService";
import { JournalPostingService } from "./services/journal/JournalPostingService";
import { JournalNumberGenerator } from "./services/journal/JournalNumberGenerator";
import { JournalReverseService } from "./services/journal/JournalReverseService";
import { OpeningBalanceService } from "./services/journal/OpeningBalanceService";
import { PeriodService } from "./services/period/PeriodService";
import { PeriodCloseService } from "./services/period/PeriodCloseService";
import { RecurringService } from "./services/recurring/RecurringService";
import { RecurringEngineService } from "./services/recurring/RecurringEngineService";
import { BankReconciliationService } from "./services/reconciliation/BankReconciliationService";

export function getChartOfAccountService() {
  return new ChartOfAccountService(new ChartOfAccountRepository());
}
export function getJournalPostingService() {
  const journalRepo = new JournalRepository();
  return new JournalPostingService(
    journalRepo,
    new ChartOfAccountRepository(),
    new PeriodRepository(),
    new JournalNumberGenerator(journalRepo),
  );
}
export function getJournalReverseService() {
  return new JournalReverseService(
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );
}
export function getOpeningBalanceService() {
  return new OpeningBalanceService(
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );
}
export function getPeriodService() {
  return new PeriodService(new PeriodRepository());
}
export function getPeriodCloseService() {
  return new PeriodCloseService(
    new PeriodRepository(),
    new JournalRepository(),
    new ChartOfAccountRepository(),
  );
}
export function getRecurringService() {
  return new RecurringService(new RecurringRepository());
}
export function getRecurringEngineService() {
  return new RecurringEngineService(
    new RecurringRepository(),
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );
}
export function getBankReconciliationService() {
  return new BankReconciliationService(new ReconciliationRepository());
}
export function getJournalRepository() {
  return new JournalRepository();
}
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

export { Money } from "./Money";

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
export { handleGoodsReceiptCreatedAccounting } from "./services/event-handlers/goods-receipt-created-accounting.handler";
export { handleGoodsReturnSentAccounting } from "./services/event-handlers/goods-return-sent-accounting.handler";
export { handleCouponUsedAccounting } from "./services/event-handlers/coupon-used-accounting.handler";
export { handleMitraWithdrawalAccounting } from "./services/event-handlers/mitra-withdrawal-accounting.handler";
export { handleInvestorPayoutAccounting } from "./services/event-handlers/investor-payout-accounting.handler";
export { handleInvestorDepositAccounting } from "./services/event-handlers/investor-deposit-accounting.handler";
export { handleSalaryProcessedAccounting } from "./services/event-handlers/salary-processed-accounting.handler";
export { handleAdvanceDisbursedAccounting } from "./services/event-handlers/advance-disbursed-accounting.handler";
