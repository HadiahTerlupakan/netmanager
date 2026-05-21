export { TaxCalculatorV2 } from "./TaxCalculatorV2";
export { TerMonthlyStrategy } from "./strategies/TerMonthlyStrategy";
export { ProgressiveAnnualStrategy } from "./strategies/ProgressiveAnnualStrategy";
export type {
  AnnualCorrectionInput,
  AnnualCorrectionResult,
  PartialYearInput,
  PartialYearResult,
} from "./strategies/ProgressiveAnnualStrategy";
export { GrossUpIterator } from "./strategies/GrossUpIterator";
export type { GrossUpInput, GrossUpResult } from "./strategies/GrossUpIterator";
export { InMemoryTaxHistoryProvider } from "./providers/TaxHistoryProvider";
export type {
  ITaxHistoryProvider,
  MonthlyTaxRecord,
  YtdTaxHistory,
} from "./providers/TaxHistoryProvider";
