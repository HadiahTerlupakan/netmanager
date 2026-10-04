import { AppError } from "@/lib/errors";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { UserLookupService } from "@/modules/users";
import type {
  LegalDocumentEntity,
  LegalPartyType,
} from "../domain/entities/LegalDocument";
import { isMonitored } from "../domain/legal-rules";
import type {
  ILegalRepository,
  LegalAccess,
  LegalDocumentFields,
  LegalDocumentFilters,
} from "../domain/ports/ILegalRepository";
import { LegalRepository } from "../repositories/LegalRepository";
import type {
  CreateLegalDocumentPayload,
  RenewLegalDocumentPayload,
  UpdateLegalDocumentPayload,
} from "../validators/legal.validator";
import { LegalCategoryService } from "./LegalCategoryService";
import { LegalPartyDirectory, type PartyOption } from "./LegalPartyDirectory";
import { LegalStorageService, type LegalUpload } from "./LegalStorageService";

/**
 * Siklus hidup dokumen legal: catat, ubah, perpanjang, akhiri.
 *
 * Perpanjangan tidak menimpa dokumen lama — dibuat dokumen baru yang menautkan
 * versi sebelumnya, sehingga riwayat kontrak/izin tetap utuh dan dokumen lama
 * otomatis berstatus "Diperpanjang".
 */

/** Direktori karyawan untuk memvalidasi PIC pilihan admin. */
export interface PicDirectory {
  filterActiveEmployeeIds(userIds: string[]): Promise<string[]>;
}

/** Pemeriksa pihak kontrak dari modul lain (mitra, reseller, pelanggan, vendor, site). */
export interface PartyResolver {
  findById(type: LegalPartyType, id: string): Promise<PartyOption | null>;
}

interface PartyFields {
  partyType?: LegalPartyType | null;
  partyId?: string | null;
  partyName?: string | null;
}

export class LegalDocumentService {
  constructor(
    private readonly repository: ILegalRepository = new LegalRepository(),
    private readonly storage: LegalStorageService = new LegalStorageService(),
    private readonly categories: LegalCategoryService = new LegalCategoryService(repository),
    private readonly directory: PicDirectory = new UserLookupService(),
    private readonly parties: PartyResolver = new LegalPartyDirectory(),
  ) {}

  /** Daftar dokumen sesuai filter; kategori rahasia tersaring sesuai akses. */
  list(filters: Omit<LegalDocumentFilters, "now">, access: LegalAccess) {
    return this.repository.findDocuments({ ...filters, now: new Date() }, access);
  }

  /** Satu dokumen; 404 juga untuk dokumen rahasia yang tidak boleh dilihat. */
  async getById(id: string, access: LegalAccess): Promise<LegalDocumentEntity> {
    const document = await this.repository.findDocumentById(id, access);
    if (!document) {
      throw new AppError("Dokumen legal tidak ditemukan", 404, "NOT_FOUND");
    }

    return document;
  }

  /** Catat dokumen baru beserta berkasnya. */
  async create(
    payload: CreateLegalDocumentPayload,
    upload: LegalUpload,
    context: { userId: string; access: LegalAccess; endorsementId?: string },
  ): Promise<LegalDocumentEntity> {
    await this.assertReferencesValid(payload, payload.documentType, context.access);
    const { obligations, ...fields } = payload;

    return this.storeNewDocument({
      fields: {
        ...fields,
        ...(await this.resolveParty(fields)),
        endorsementId: context.endorsementId ?? null,
      },
      obligations,
      upload,
      createdById: context.userId,
    });
  }

  /** Ubah data dokumen; daftar kewajiban diganti utuh bila dikirim. */
  async update(
    id: string,
    payload: UpdateLegalDocumentPayload,
    access: LegalAccess,
  ): Promise<LegalDocumentEntity> {
    const document = await this.getById(id, access);
    await this.assertReferencesValid(payload, document.documentType, access);
    const { obligations, ...fields } = payload;
    const partyPatch = await this.resolveParty(fields);

    return this.repository.updateDocument(
      id,
      { ...fields, ...partyPatch },
      obligations,
      document.tenantId,
    );
  }

  /**
   * Perpanjang dokumen: dokumen baru dengan masa berlaku baru, menautkan versi
   * lama. Tanpa unggahan baru, berkas lama dipakai ulang (mis. izin yang
   * diperpanjang dengan dokumen yang sama).
   */
  async renew(
    id: string,
    payload: RenewLegalDocumentPayload,
    upload: LegalUpload | null,
    context: { userId: string; access: LegalAccess },
  ): Promise<LegalDocumentEntity> {
    const previous = await this.getById(id, context.access);
    if (!isMonitored(previous)) {
      throw new AppError("Dokumen ini sudah diperpanjang atau diakhiri", 409, "INVALID_STATE");
    }
    await this.assertReferencesValid(payload, previous.documentType, context.access);

    const { obligations, ...changes } = payload;
    const fields = { ...this.carryOverFields(previous), ...changes };
    return this.storeNewDocument({
      fields: { ...fields, ...(await this.resolveParty(fields)) },
      obligations: obligations ?? previous.obligations,
      upload,
      createdById: context.userId,
      previous,
    });
  }

  /** Akhiri dokumen sebelum waktunya (mis. kontrak diputus); pengingat berhenti. */
  async terminate(id: string, reason: string, access: LegalAccess): Promise<void> {
    const document = await this.getById(id, access);
    if (!isMonitored(document)) {
      throw new AppError("Dokumen ini sudah diperpanjang atau diakhiri", 409, "INVALID_STATE");
    }

    await this.repository.terminateDocument(id, reason, new Date());
  }

  /** Isi berkas dokumen untuk disajikan lewat rute server. */
  async readFile(id: string, access: LegalAccess) {
    const document = await this.getById(id, access);

    return {
      buffer: await this.storage.read(document.fileKey),
      fileName: document.fileName,
      contentType: document.fileContentType,
    };
  }

  private async storeNewDocument(input: {
    fields: LegalDocumentFields;
    obligations: CreateLegalDocumentPayload["obligations"];
    upload: LegalUpload | null;
    createdById: string;
    previous?: LegalDocumentEntity;
  }): Promise<LegalDocumentEntity> {
    const { tenantId } = await getTenantIdFromContext();
    const documentId = crypto.randomUUID();
    const file = input.upload
      ? await this.storage.save({ tenantId, documentId, upload: input.upload })
      : this.reuseFile(input.previous);

    try {
      return await this.repository.createDocument({
        ...input.fields,
        ...file,
        id: documentId,
        previousDocumentId: input.previous?.id,
        createdById: input.createdById,
        tenantId,
        obligations: input.obligations,
      });
    } catch (error) {
      // Berkas baru yang gagal dicatat dibuang supaya tidak yatim di penyimpanan.
      if (input.upload) await this.storage.remove(file.fileKey);
      throw error;
    }
  }

  private reuseFile(previous: LegalDocumentEntity | undefined) {
    if (!previous) {
      throw new AppError("Berkas dokumen wajib diunggah", 400, "VALIDATION_ERROR");
    }

    return {
      fileKey: previous.fileKey,
      fileName: previous.fileName,
      fileHash: previous.fileHash,
      fileContentType: previous.fileContentType,
    };
  }

  /** Field yang terbawa ke versi perpanjangan bila tidak diubah. */
  private carryOverFields(previous: LegalDocumentEntity): LegalDocumentFields {
    return {
      title: previous.title,
      documentType: previous.documentType,
      categoryId: previous.category?.id ?? null,
      documentNumber: previous.documentNumber,
      partyName: previous.partyName,
      partyType: previous.partyType,
      partyId: previous.partyId,
      value: previous.value,
      currency: previous.currency,
      paymentScheme: previous.paymentScheme,
      isAutoRenew: previous.isAutoRenew,
      noticePeriodDays: previous.noticePeriodDays,
      penaltyNotes: previous.penaltyNotes,
      disputeResolution: previous.disputeResolution,
      notes: previous.notes,
      picUserId: previous.pic?.id ?? null,
    };
  }

  /**
   * Pihak tertaut (jenis + id) harus ada di tenant ini; nama pihak diisi dari
   * datanya bila admin tidak menulis sendiri. Pihak teks bebas dibiarkan.
   * Hanya diperiksa bila field pihak ikut dikirim (perubahan sebagian).
   */
  private async resolveParty(fields: PartyFields): Promise<PartyFields> {
    if (fields.partyType === undefined && fields.partyId === undefined) return {};
    if (!fields.partyType && !fields.partyId) return { partyType: null, partyId: null };
    if (!fields.partyType || !fields.partyId) {
      throw new AppError("Jenis dan pilihan pihak harus diisi bersamaan", 400, "VALIDATION_ERROR");
    }

    const party = await this.parties.findById(fields.partyType, fields.partyId);
    if (!party) {
      throw new AppError("Pihak yang dipilih tidak ditemukan", 400, "VALIDATION_ERROR");
    }

    return { partyName: fields.partyName || party.name };
  }

  /** Kategori harus milik tenant & cocok jenisnya; PIC harus karyawan aktif. */
  private async assertReferencesValid(
    payload: { categoryId?: string | null; picUserId?: string | null },
    documentType: LegalDocumentEntity["documentType"],
    access: LegalAccess,
  ): Promise<void> {
    if (payload.categoryId) {
      await this.categories.assertUsable(payload.categoryId, documentType, access);
    }
    if (payload.picUserId) {
      const [activeId] = await this.directory.filterActiveEmployeeIds([payload.picUserId]);
      if (!activeId) {
        throw new AppError("PIC harus karyawan aktif", 400, "VALIDATION_ERROR");
      }
    }
  }
}
