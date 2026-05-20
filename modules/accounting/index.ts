export { ChartOfAccountService } from "./services/coa/ChartOfAccountService";
export { JournalPostingService } from "./services/journal/JournalPostingService";
export { JournalNumberGenerator } from "./services/journal/JournalNumberGenerator";
export { PeriodService } from "./services/period/PeriodService";

export { ChartOfAccountRepository } from "./repositories/ChartOfAccountRepository";
export { JournalRepository } from "./repositories/JournalRepository";
export { PeriodRepository } from "./repositories/PeriodRepository";

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

export { handleInvoiceCreatedAccounting } from "./services/event-handlers/invoice-created-accounting.handler";
export { handleInvoicePaidAccounting } from "./services/event-handlers/invoice-paid-accounting.handler";
export { handleExpenseApprovedAccounting } from "./services/event-handlers/expense-approved-accounting.handler";
export { handlePurchaseOrderPaidAccounting } from "./services/event-handlers/purchase-order-paid-accounting.handler";
