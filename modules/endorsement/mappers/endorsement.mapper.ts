import type {
  EndorsementEntity,
  EndorsementSignerEntity,
  EndorsementSourceType,
  EndorsementStatus,
  SignerStatus,
} from "../domain/entities/Endorsement";

/**
 * Pemetaan baris Prisma ke entitas domain.
 *
 * Kolom status disimpan sebagai teks di database supaya penambahan status baru
 * tidak menuntut migrasi enum; pemetaan inilah yang mengembalikan ketatnya tipe
 * saat masuk ke domain.
 */

export interface EndorsementSignerRow {
  id: string;
  endorsementId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  userId: string | null;
  status: string;
  signatureKey: string | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
  order: number;
}

export interface EndorsementRow {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  sourceType: string;
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
  signers: EndorsementSignerRow[];
}

export function toSignerEntity(
  row: EndorsementSignerRow,
): EndorsementSignerEntity {
  return {
    id: row.id,
    endorsementId: row.endorsementId,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    userId: row.userId,
    status: row.status as SignerStatus,
    signatureKey: row.signatureKey,
    viewedAt: row.viewedAt,
    signedAt: row.signedAt,
    declinedAt: row.declinedAt,
    declineReason: row.declineReason,
    order: row.order,
  };
}

export function toEndorsementEntity(row: EndorsementRow): EndorsementEntity {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status as EndorsementStatus,
    sourceType: row.sourceType as EndorsementSourceType,
    sourceId: row.sourceId,
    sourceFileKey: row.sourceFileKey,
    sourceFileName: row.sourceFileName,
    sourceFileHash: row.sourceFileHash,
    signedFileKey: row.signedFileKey,
    signedFileHash: row.signedFileHash,
    expiresAt: row.expiresAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    createdById: row.createdById,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    signers: row.signers.map(toSignerEntity),
  };
}
