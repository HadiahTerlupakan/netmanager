import type {
  EndorsementEntity,
  EndorsementEventType,
  EndorsementStatus,
  SignerStatus,
} from "../entities/Endorsement";

/**
 * Kontrak akses data surat pengesahan.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface EndorsementListFilters {
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateEndorsementInput {
  number: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceId?: string;
  sourceFileKey: string;
  sourceFileName: string;
  sourceFileHash: string;
  expiresAt?: Date;
  createdById: string;
  tenantId: string | null;
  signers: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    userId?: string;
    tokenHash: string;
    order: number;
  }>;
}

export interface RecordEventInput {
  endorsementId: string;
  signerId?: string;
  type: EndorsementEventType;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  tenantId: string | null;
}

export interface IEndorsementRepository {
  findMany(
    filters: EndorsementListFilters,
  ): Promise<{ items: EndorsementEntity[]; total: number }>;
  findById(id: string): Promise<EndorsementEntity | null>;
  findByTokenHash(
    tokenHash: string,
  ): Promise<{ endorsement: EndorsementEntity; signerId: string } | null>;
  findLastNumber(tenantId: string | null): Promise<string | null>;
  create(input: CreateEndorsementInput): Promise<EndorsementEntity>;
  updateStatus(
    id: string,
    status: EndorsementStatus,
    extra?: {
      completedAt?: Date;
      cancelledAt?: Date;
      cancelReason?: string;
      signedFileKey?: string;
      signedFileHash?: string;
    },
  ): Promise<void>;
  updateSigner(
    signerId: string,
    data: {
      status?: SignerStatus;
      signatureKey?: string;
      viewedAt?: Date;
      signedAt?: Date;
      declinedAt?: Date;
      declineReason?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void>;
  recordEvent(input: RecordEventInput): Promise<void>;
  findExpiredIds(now: Date): Promise<string[]>;
}
