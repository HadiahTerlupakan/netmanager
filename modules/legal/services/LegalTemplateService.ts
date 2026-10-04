import { AppError } from "@/lib/errors";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { DEFAULT_LEGAL_TEMPLATES } from "../domain/default-templates";
import type { LegalTemplateEntity } from "../domain/entities/LegalTemplate";
import type { LegalAccess } from "../domain/ports/ILegalRepository";
import type { ILegalTemplateRepository } from "../domain/ports/ILegalTemplateRepository";
import { LegalTemplateRepository } from "../repositories/LegalTemplateRepository";
import type {
  CreateLegalTemplatePayload,
  UpdateLegalTemplatePayload,
} from "../validators/legal-template.validator";
import { LegalCategoryService } from "./LegalCategoryService";

/** Template dokumen legal per tenant, termasuk penyediaan template bawaan. */
export class LegalTemplateService {
  constructor(
    private readonly repository: ILegalTemplateRepository = new LegalTemplateRepository(),
    private readonly categories: LegalCategoryService = new LegalCategoryService(),
  ) {}

  /**
   * Daftar template. Saat tenant pertama kali membuka daftar (belum ada
   * template sama sekali), template bawaan dibuat lebih dulu.
   */
  async list(): Promise<LegalTemplateEntity[]> {
    await this.ensureDefaults();
    return this.repository.listTemplates();
  }

  /** Satu template; 404 bila tidak ada di tenant ini. */
  async getById(id: string): Promise<LegalTemplateEntity> {
    const template = await this.repository.findTemplateById(id);
    if (!template) {
      throw new AppError("Template tidak ditemukan", 404, "NOT_FOUND");
    }

    return template;
  }

  /** Tambah template milik tenant. */
  async create(
    payload: CreateLegalTemplatePayload,
    access: LegalAccess,
  ): Promise<LegalTemplateEntity> {
    if (payload.categoryId) {
      await this.categories.assertUsable(payload.categoryId, payload.documentType, access);
    }
    const { tenantId } = await getTenantIdFromContext();

    return this.repository.createTemplate({ ...payload, tenantId });
  }

  /** Ubah nama, kategori, isi, atau status aktif; template bawaan juga boleh disesuaikan. */
  async update(
    id: string,
    payload: UpdateLegalTemplatePayload,
    access: LegalAccess,
  ): Promise<LegalTemplateEntity> {
    const template = await this.getById(id);
    if (payload.categoryId) {
      await this.categories.assertUsable(payload.categoryId, template.documentType, access);
    }

    return this.repository.updateTemplate(id, payload);
  }

  private async ensureDefaults(): Promise<void> {
    if ((await this.repository.countTemplates()) > 0) return;

    const { tenantId } = await getTenantIdFromContext();
    await this.repository.createTemplates(
      DEFAULT_LEGAL_TEMPLATES.map((template) => ({
        ...template,
        content: [...template.content],
        isBuiltIn: true,
        tenantId,
      })),
    );
  }
}
