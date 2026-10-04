import { AppError } from "@/lib/errors";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { DEFAULT_LEGAL_CATEGORIES } from "../domain/default-categories";
import type {
  LegalCategoryEntity,
  LegalConfidentiality,
  LegalDocumentType,
} from "../domain/entities/LegalDocument";
import type {
  ILegalRepository,
  LegalAccess,
} from "../domain/ports/ILegalRepository";
import { LegalRepository } from "../repositories/LegalRepository";

/** Kategori dokumen legal per tenant, termasuk penyediaan kategori bawaan. */
export class LegalCategoryService {
  constructor(
    private readonly repository: ILegalRepository = new LegalRepository(),
  ) {}

  /**
   * Daftar kategori. Saat tenant pertama kali membuka modul (belum ada kategori
   * sama sekali), kategori bawaan dibuat lebih dulu.
   */
  async list(access: LegalAccess): Promise<LegalCategoryEntity[]> {
    await this.ensureDefaults();
    return this.repository.listCategories(access);
  }

  /** Tambah kategori milik tenant. */
  async create(input: {
    name: string;
    documentType: LegalDocumentType;
    confidentiality: LegalConfidentiality;
  }): Promise<LegalCategoryEntity> {
    const { tenantId } = await getTenantIdFromContext();
    return this.repository.createCategory({ ...input, tenantId });
  }

  /** Ubah nama, tingkat kerahasiaan, atau status aktif kategori. */
  async update(
    id: string,
    data: Partial<Pick<LegalCategoryEntity, "name" | "confidentiality" | "isActive">>,
    access: LegalAccess,
  ): Promise<LegalCategoryEntity> {
    const category = await this.repository.findCategoryById(id, access);
    if (!category) {
      throw new AppError("Kategori tidak ditemukan", 404, "NOT_FOUND");
    }

    return this.repository.updateCategory(id, data);
  }

  /** Pastikan kategori ada di tenant ini sebelum dokumen memakainya. */
  async assertUsable(
    categoryId: string,
    documentType: LegalDocumentType,
    access: LegalAccess,
  ): Promise<void> {
    const category = await this.repository.findCategoryById(categoryId, access);
    if (!category || !category.isActive) {
      throw new AppError("Kategori tidak ditemukan atau nonaktif", 400, "VALIDATION_ERROR");
    }
    if (category.documentType !== documentType) {
      throw new AppError("Kategori tidak sesuai dengan jenis dokumen", 400, "VALIDATION_ERROR");
    }
  }

  private async ensureDefaults(): Promise<void> {
    if ((await this.repository.countCategories()) > 0) return;

    const { tenantId } = await getTenantIdFromContext();
    await this.repository.createCategories(
      DEFAULT_LEGAL_CATEGORIES.map((category) => ({
        ...category,
        isBuiltIn: true,
        tenantId,
      })),
    );
  }
}
