/**
 * Entitas domain surat pengesahan.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const ENDORSEMENT_STATUSES = [
  "DRAFT",
  "SENT",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type EndorsementStatus = (typeof ENDORSEMENT_STATUSES)[number];

export const ENDORSEMENT_SOURCE_TYPES = [
  "UPLOAD",
  "PLANNING",
  "PURCHASE_ORDER",
  "WORK_ORDER",
] as const;

export type EndorsementSourceType = (typeof ENDORSEMENT_SOURCE_TYPES)[number];

export const SIGNER_STATUSES = [
  "PENDING",
  "VIEWED",
  "SIGNED",
  "DECLINED",
] as const;

export type SignerStatus = (typeof SIGNER_STATUSES)[number];

export const ENDORSEMENT_EVENT_TYPES = [
  "CREATED",
  "SENT",
  "VIEWED",
  "SIGNED",
  "DECLINED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type EndorsementEventType = (typeof ENDORSEMENT_EVENT_TYPES)[number];

export interface EndorsementSignerEntity {
  id: string;
  endorsementId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  userId: string | null;
  status: SignerStatus;
  signatureKey: string | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
  order: number;
}

export interface EndorsementEntity {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: EndorsementStatus;
  sourceType: EndorsementSourceType;
  sourceId: string | null;
  sourceFileKey: string;
  sourceFileName: string;
  sourceFileHash: string;
  signedFileKey: string | null;
  signedFileHash: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdById: string;
  tenantId: string | null;
  createdAt: Date;
  signers: EndorsementSignerEntity[];
}
