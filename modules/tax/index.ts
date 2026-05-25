// Module: Tax
// Public API — all external access to this module goes through here.

import { TaxConfigRepository } from "./repositories/TaxConfigRepository";
import { TaxTransactionRepository } from "./repositories/TaxTransactionRepository";
import { TaxPeriodRepository } from "./repositories/TaxPeriodRepository";
import { TaxRateConfigRepository } from "./repositories/TaxRateConfigRepository";
import { TaxConfigService } from "./services/TaxConfigService";
import { PpnService } from "./services/PpnService";
import { PpnRateResolver } from "./services/PpnRateResolver";
import { PphService } from "./services/PphService";
import { BhpUsoService } from "./services/BhpUsoService";
import { TaxPeriodService } from "./services/TaxPeriodService";
import { TaxReminderService } from "./services/TaxReminderService";
import { TaxExportService } from "./services/TaxExportService";
import { TaxTransactionService } from "./services/TaxTransactionService";
import { TaxRateConfigService } from "./services/TaxRateConfigService";
import { CoretaxExportAdapter } from "./services/CoretaxExportAdapter";

// Factory functions (pre-wired with repositories)

export function getTaxConfigService(): TaxConfigService {
  return new TaxConfigService(new TaxConfigRepository());
}

export function getPpnService(): PpnService {
  return new PpnService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
    new TaxRateConfigRepository(),
  );
}

export function getPpnRateResolver(): PpnRateResolver {
  return new PpnRateResolver(
    new TaxConfigRepository(),
    new TaxRateConfigRepository(),
  );
}

export function getPphService(): PphService {
  return new PphService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
    new TaxRateConfigRepository(),
  );
}

export function getBhpUsoService(): BhpUsoService {
  return new BhpUsoService(
    new TaxConfigRepository(),
    new TaxTransactionRepository(),
    new TaxRateConfigRepository(),
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
    new TaxRateConfigRepository(),
  );
}

export function getTaxExportService(): TaxExportService {
  return new TaxExportService(
    new TaxTransactionRepository(),
    new TaxPeriodRepository(),
    new TaxConfigRepository(),
    new TaxRateConfigRepository(),
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

export function getTaxRateConfigService(): TaxRateConfigService {
  return new TaxRateConfigService(new TaxRateConfigRepository());
}

// Event handlers
export { handleInvoiceCreatedTax } from "./services/event-handlers/invoice-created-tax.handler";
export { handleExpenseApprovedTax } from "./services/event-handlers/expense-approved-tax.handler";
export { handlePurchaseOrderPaidTax } from "./services/event-handlers/purchase-order-paid-tax.handler";
export { handleGoodsReceiptCreatedTax } from "./services/event-handlers/goods-receipt-created-tax.handler";
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
export {
  classifyPph,
  PPH_OPTIONS,
  PPH_LABEL,
  getPphLabel,
} from "./services/PphClassifier";
export type { PphClassification, PphOption } from "./services/PphClassifier";
export { PphService } from "./services/PphService";
export { BhpUsoService } from "./services/BhpUsoService";
export { TaxPeriodService } from "./services/TaxPeriodService";
export { TaxReminderService } from "./services/TaxReminderService";
export { TaxExportService } from "./services/TaxExportService";
export { TaxTransactionService } from "./services/TaxTransactionService";
export { TaxRateConfigService } from "./services/TaxRateConfigService";
export { CoretaxExportAdapter } from "./services/CoretaxExportAdapter";

// Tax rate config types (boleh di-import dari client juga - pure types)
export type {
  TaxRateConfig,
  TaxRateCategoryValue,
  CreateTaxRateConfigInput,
  UpdateTaxRateConfigInput,
} from "./domain/entities/TaxRateConfig";
