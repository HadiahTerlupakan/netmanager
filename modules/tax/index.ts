// Module: Tax
// Public API — all external access to this module goes through here.

import { TaxConfigRepository } from "./repositories/TaxConfigRepository";
import { TaxTransactionRepository } from "./repositories/TaxTransactionRepository";
import { TaxPeriodRepository } from "./repositories/TaxPeriodRepository";
import { TaxConfigService } from "./services/TaxConfigService";
import { PpnService } from "./services/PpnService";
import { PpnRateResolver } from "./services/PpnRateResolver";
import { PphService } from "./services/PphService";
import { BhpUsoService } from "./services/BhpUsoService";
import { TaxPeriodService } from "./services/TaxPeriodService";
import { TaxReminderService } from "./services/TaxReminderService";
import { TaxExportService } from "./services/TaxExportService";
import { TaxTransactionService } from "./services/TaxTransactionService";
import { CoretaxExportAdapter } from "./services/CoretaxExportAdapter";

// Factory functions (pre-wired with repositories)

export function getTaxConfigService(): TaxConfigService {
  return new TaxConfigService(new TaxConfigRepository());
}

export function getPpnService(): PpnService {
  return new PpnService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
  );
}

export function getPpnRateResolver(): PpnRateResolver {
  return new PpnRateResolver(new TaxConfigRepository());
}

export function getPphService(): PphService {
  return new PphService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
  );
}

export function getBhpUsoService(): BhpUsoService {
  return new BhpUsoService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
  );
}

export function getTaxPeriodService(): TaxPeriodService {
  return new TaxPeriodService(
    new TaxPeriodRepository(),
    new TaxTransactionRepository(),
  );
}

export function getTaxReminderService(): TaxReminderService {
  return new TaxReminderService(
    new TaxConfigRepository(),
    new TaxPeriodRepository(),
  );
}

export function getTaxExportService(): TaxExportService {
  return new TaxExportService(
    new TaxTransactionRepository(),
    new TaxPeriodRepository(),
    new TaxConfigRepository(),
  );
}

export function getCoretaxExportAdapter(): CoretaxExportAdapter {
  return new CoretaxExportAdapter(
    new TaxTransactionRepository(),
    new TaxConfigRepository(),
  );
}

export function getTaxTransactionService(): TaxTransactionService {
  return new TaxTransactionService(new TaxTransactionRepository());
}

// Event handlers
export { handleInvoiceCreatedTax } from "./services/event-handlers/invoice-created-tax.handler";
export { handleExpenseApprovedTax } from "./services/event-handlers/expense-approved-tax.handler";
export { handlePurchaseOrderPaidTax } from "./services/event-handlers/purchase-order-paid-tax.handler";
export { handleSalaryProcessedTax } from "./services/event-handlers/salary-processed-tax.handler";
export { handleInvestorPayoutTax } from "./services/event-handlers/investor-payout-tax.handler";

// Domain types
export type {
  TaxConfig,
  TaxType,
  TaxDirection,
} from "./domain/entities/TaxConfig";
export type { TaxTransaction } from "./domain/entities/TaxTransaction";
export type {
  TaxPeriodSummary,
  TaxPayStatus,
} from "./domain/entities/TaxPeriod";
export type {
  TaxTransactionListFilter,
  TaxTransactionListResult,
} from "./domain/ports/ITaxTransactionRepository";

// Services (for direct import if needed)
export { TaxConfigService } from "./services/TaxConfigService";
export { PpnService } from "./services/PpnService";
export { PpnRateResolver } from "./services/PpnRateResolver";
export { classifyPph } from "./services/PphClassifier";
export type { PphClassification } from "./services/PphClassifier";
export { PphService } from "./services/PphService";
export { BhpUsoService } from "./services/BhpUsoService";
export { TaxPeriodService } from "./services/TaxPeriodService";
export { TaxReminderService } from "./services/TaxReminderService";
export { TaxExportService } from "./services/TaxExportService";
export { TaxTransactionService } from "./services/TaxTransactionService";
export { CoretaxExportAdapter } from "./services/CoretaxExportAdapter";
