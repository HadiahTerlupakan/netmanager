// Module: Tax — client-safe public entrypoint.
// Hanya re-export pure helpers/types yang aman dipakai di client component.
// Jangan tambahkan service/repository/event-handler di sini karena akan
// menarik dependency server-only (firebase-admin, prisma, dll) ke browser bundle.

export {
  classifyPph,
  PPH_OPTIONS,
  PPH_LABEL,
  getPphLabel,
} from "./services/PphClassifier";

export type { PphClassification, PphOption } from "./services/PphClassifier";

export type {
  TaxRateConfig,
  TaxRateCategoryValue,
  CreateTaxRateConfigInput,
  UpdateTaxRateConfigInput,
} from "./domain/entities/TaxRateConfig";
