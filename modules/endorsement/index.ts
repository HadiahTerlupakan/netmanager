/**
 * Public API modul surat pengesahan.
 *
 * Modul lain hanya boleh mengimpor dari berkas ini.
 */

export {
  ENDORSEMENT_EVENT_TYPES,
  ENDORSEMENT_SOURCE_TYPES,
  ENDORSEMENT_STATUSES,
  SIGNER_STATUSES,
  type EndorsementEntity,
  type EndorsementEventType,
  type EndorsementSignerEntity,
  type EndorsementSourceType,
  type EndorsementStatus,
  type SignerStatus,
} from "./domain/entities/Endorsement";

export {
  canSign,
  countSigned,
  hasDecline,
  isExpired,
  isFullySigned,
  resolveEndorsementStatus,
} from "./domain/endorsement-rules";

export {
  generateSignerToken,
  hashSignerToken,
  isSameTokenHash,
  isValidTokenFormat,
} from "./services/endorsement-token";

export {
  buildEndorsementNumber,
  buildEndorsementPeriod,
  buildNextEndorsementNumber,
  parseEndorsementSequence,
} from "./services/endorsement-number";

export {
  cancelEndorsementSchema,
  createEndorsementSchema,
  declineEndorsementSchema,
  endorsementSignerInputSchema,
  listEndorsementSchema,
  signEndorsementSchema,
  signerStatusSchema,
  updateEndorsementSchema,
} from "./validators/endorsement.validator";

export { EndorsementService } from "./services/EndorsementService";
export { EndorsementPdfService } from "./services/EndorsementPdfService";
export { EndorsementStorageService } from "./services/EndorsementStorageService";

export {
  toEndorsementDetail,
  toEndorsementListItem,
  toSignerDto,
  type EndorsementDetailDto,
  type EndorsementListItemDto,
  type EndorsementSignerDto,
} from "./dto/endorsement.dto";

export { parseSignatureDataUrl } from "./services/endorsement-signature-image";

export {
  buildSignerUrl,
  EndorsementNotificationService,
  type DeliveryOutcome,
} from "./services/EndorsementNotificationService";
export type { SignerLink } from "./services/EndorsementService";
