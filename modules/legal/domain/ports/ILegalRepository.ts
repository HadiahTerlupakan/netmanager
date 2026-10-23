import type {
  LegalCategoryEntity,
  LegalConfidentiality,
  LegalDocumentEntity,
  LegalDocumentStatus,
  LegalDocumentType,
  LegalPartyType,
  LegalPaymentScheme,
  LegalRecurrence,
} from "../entities/LegalDocument";

/**
 * Kontrak akses data modul legal.
 *
 * `canViewConfidential` selalu diteruskan ke repository: penyaringan kategori
 * rahasia ditegakkan di query, bukan di UI, sehingga tidak ada jalur baca yang
 * lupa menyaringnya.
 */

export interface LegalAccess {
  canViewConfidential: boolean;
}

export interface LegalDocumentFilters {
  documentType?: LegalDocumentType;
  categoryId?: string;
  status?: LegalDocumentStatus;
  search?: string;
  page: number;
  limit: number;
  now: Date;
}

export interface LegalObligationInput {
  description: string;
  dueDate: Date;
  recurrence: LegalRecurrence;
}

export interface LegalDocumentFields {
  title: string;
  documentType: LegalDocumentType;
  categoryId?: string | null;
  documentNumber?: string | null;
  partyName?: string | null;
  partyType?: LegalPartyType | null;
  partyId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  value?: string | null;
  currency?: string;
  paymentScheme?: LegalPaymentScheme | null;
  guaranteeDescription?: string | null;
  guaranteeEndDate?: Date | null;
  isAutoRenew?: boolean;
  noticePeriodDays?: number | null;
  penaltyNotes?: string | null;
  disputeResolution?: string | null;
  notes?: string | null;
  picUserId?: string | null;
  endorsementId?: string | null;
}

export interface LegalFileFields {
  fileKey: string;
  fileName: string;
  fileHash: string;
  fileContentType: string;
}

export interface CreateLegalDocumentInput extends LegalDocumentFields, LegalFileFields {
  id: string;
  previousDocumentId?: string;
  createdById: string;
  tenantId: string | null;
  obligations: LegalObligationInput[];
}

export interface LegalCategoryInput {
  name: string;
  documentType: LegalDocumentType;
  confidentiality: LegalConfidentiality;
  isBuiltIn?: boolean;
  tenantId: string | null;
}

export interface ILegalRepository {
  countCategories(): Promise<number>;
  createCategories(inputs: LegalCategoryInput[]): Promise<void>;
  listCategories(access: LegalAccess): Promise<LegalCategoryEntity[]>;
  findCategoryById(id: string, access: LegalAccess): Promise<LegalCategoryEntity | null>;
  createCategory(input: LegalCategoryInput): Promise<LegalCategoryEntity>;
  updateCategory(
    id: string,
    data: Partial<Pick<LegalCategoryEntity, "name" | "confidentiality" | "isActive">>,
  ): Promise<LegalCategoryEntity>;

  findDocuments(
    filters: LegalDocumentFilters,
    access: LegalAccess,
  ): Promise<{ items: LegalDocumentEntity[]; total: number }>;
  findDocumentById(id: string, access: LegalAccess): Promise<LegalDocumentEntity | null>;
  createDocument(input: CreateLegalDocumentInput): Promise<LegalDocumentEntity>;
  updateDocument(
    id: string,
    fields: Partial<LegalDocumentFields>,
    obligations: LegalObligationInput[] | undefined,
    tenantId: string | null,
  ): Promise<LegalDocumentEntity>;
  terminateDocument(id: string, reason: string, at: Date): Promise<void>;
  /** Dokumen yang masih dipantau dan punya tenggat — untuk dasbor dan cron. */
  findMonitoredDocuments(access: LegalAccess): Promise<LegalDocumentEntity[]>;
  /** Tautkan dokumen ke surat pengesahan yang sedang/telah menandatanganinya. */
  linkEndorsement(documentId: string, endorsementId: string): Promise<void>;
  /** Ganti berkas dokumen dengan versi yang sudah disahkan. */
  replaceFile(documentId: string, file: LegalFileFields): Promise<void>;
  /** Id dokumen yang tertaut ke surat pengesahan ini, bila ada. */
  findDocumentIdByEndorsement(endorsementId: string): Promise<string | null>;
  /** Catat pengingat; false bila pengingat yang sama sudah pernah tercatat. */
  recordReminder(input: {
    documentId: string;
    deadlineKey: string;
    threshold: string;
    tenantId: string | null;
  }): Promise<boolean>;
}
