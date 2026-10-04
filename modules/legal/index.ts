/**
 * Public API modul legal (kontrak, izin, sewa lahan, dokumen korporat).
 *
 * Modul lain hanya boleh mengimpor dari berkas ini.
 */

export {
  LEGAL_CONFIDENTIALITY_LEVELS,
  LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_PARTY_TYPES,
  LEGAL_PAYMENT_SCHEMES,
  LEGAL_RECURRENCES,
  type LegalDocumentEntity,
  type LegalDocumentStatus,
  type LegalDocumentType,
} from "./domain/entities/LegalDocument";
export {
  deriveStatus,
  listDeadlines,
  reminderThresholdFor,
} from "./domain/legal-rules";
export type { LegalAccess } from "./domain/ports/ILegalRepository";
export {
  TEMPLATE_BLOCK_TYPES,
  TEMPLATE_PLACEHOLDERS,
  type TemplateBlock,
} from "./domain/template-content";

export {
  archiveEndorsementSchema,
  partyOptionsQuerySchema,
  sendForSignatureSchema,
  createLegalCategorySchema,
  createLegalDocumentSchema,
  listLegalDocumentsSchema,
  renewLegalDocumentSchema,
  terminateLegalDocumentSchema,
  updateLegalCategorySchema,
  updateLegalDocumentSchema,
} from "./validators/legal.validator";

export {
  toLegalCategoryDto,
  toLegalDocumentDetail,
  toLegalDocumentListItem,
  type LegalCategoryDto,
  type LegalDocumentDetailDto,
  type LegalDocumentListItemDto,
  toLegalTemplateDto,
  type LegalTemplateDto,
} from "./dto/legal.dto";
export {
  createDocumentFromTemplateSchema,
  createLegalTemplateSchema,
  previewLegalTemplateSchema,
  updateLegalTemplateSchema,
} from "./validators/legal-template.validator";

export { LegalCategoryService } from "./services/LegalCategoryService";
export { LegalDocumentService } from "./services/LegalDocumentService";
export {
  LegalDashboardService,
  type LegalDashboardDto,
} from "./services/LegalDashboardService";
export { LegalReminderService } from "./services/LegalReminderService";
export { LegalTemplateService } from "./services/LegalTemplateService";
export { LegalTemplateDocumentService } from "./services/LegalTemplateDocumentService";
export {
  LegalPartyDirectory,
  type PartyOption,
} from "./services/LegalPartyDirectory";
export {
  LegalSigningService,
  type SendForSignatureInput,
} from "./services/LegalSigningService";
export { handleEndorsementCompletedLegal } from "./services/event-handlers/endorsement-completed-legal.handler";
export {
  ALLOWED_LEGAL_CONTENT_TYPES,
  MAX_LEGAL_FILE_BYTES,
  type LegalUpload,
} from "./services/LegalStorageService";
