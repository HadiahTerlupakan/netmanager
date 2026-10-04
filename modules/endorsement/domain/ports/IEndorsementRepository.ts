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
  status?: EndorsementStatus;
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

export interface EndorsementStatusExtra {
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  signedFileKey?: string;
  signedFileHash?: string;
}

export interface SignerUpdateData {
  status?: SignerStatus;
  signatureKey?: string;
  viewedAt?: Date;
  signedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  ipAddress?: string;
  userAgent?: string;
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
  /**
   * Ubah status surat hanya bila statusnya masih salah satu dari `fromStatuses`.
   * Mengembalikan false bila permintaan lain sudah lebih dulu mengubahnya —
   * pemeriksaan dan penulisan terjadi dalam satu pernyataan, jadi aman dari race.
   */
  transitionStatus(
    id: string,
    fromStatuses: EndorsementStatus[],
    status: EndorsementStatus,
    extra?: EndorsementStatusExtra,
  ): Promise<boolean>;
  /** Ubah penanda tangan hanya bila statusnya masih salah satu dari `fromStatuses`. */
  transitionSigner(
    signerId: string,
    fromStatuses: SignerStatus[],
    data: SignerUpdateData,
  ): Promise<boolean>;
  updateSignerTokenHash(signerId: string, tokenHash: string): Promise<void>;
  recordEvent(input: RecordEventInput): Promise<void>;
  /** Surat terkirim yang lewat masa berlaku dan belum ditandatangani semua. */
  findExpired(
    now: Date,
  ): Promise<Array<{ id: string; tenantId: string | null }>>;
  /** Surat terkirim yang semua penanda tangannya sudah tanda tangan, tapi belum final. */
  findFullySignedOpenIds(): Promise<string[]>;
}
