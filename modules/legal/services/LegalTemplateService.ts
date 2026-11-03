import { AppError } from "@/lib/errors";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  DEFAULT_LEGAL_TEMPLATES,
  type DefaultLegalTemplate,
} from "../domain/default-templates";
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
   * Daftar template. Template bawaan yang belum dimiliki tenant dibuat lebih
   * dulu (lihat `selectMissingDefaults`).
   */
  async list(): Promise<LegalTemplateEntity[]> {
    const templates = await this.repository.listTemplates();
    const missingDefaults = selectMissingDefaults(templates);
    if (missingDefaults.length === 0) return templates;

    await this.createBuiltInTemplates(missingDefaults);
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
      await this.categories.assertUsable(
        payload.categoryId,
        payload.documentType,
        access,
      );
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
      await this.categories.assertUsable(
        payload.categoryId,
        template.documentType,
        access,
      );
    }

    return this.repository.updateTemplate(id, payload);
  }

  private async createBuiltInTemplates(
    defaults: DefaultLegalTemplate[],
  ): Promise<void> {
    const { tenantId } = await getTenantIdFromContext();
    await this.repository.createTemplates(
      defaults.map(({ name, documentType, content }) => ({
        name,
        documentType,
        content: [...content],
        isBuiltIn: true,
        tenantId,
      })),
    );
  }
}

/**
 * Template bawaan yang perlu dibuat: semuanya bila tenant belum punya
 * template; bila sudah, hanya template bertanda `isSeededForExistingTenants`
 * yang namanya belum ada. Template tenant tidak pernah ditimpa.
 */
function selectMissingDefaults(
  existing: LegalTemplateEntity[],
): DefaultLegalTemplate[] {
  if (existing.length === 0) return [...DEFAULT_LEGAL_TEMPLATES];

  const existingNames = new Set(existing.map((template) => template.name));
  return DEFAULT_LEGAL_TEMPLATES.filter(
    (template) =>
      template.isSeededForExistingTenants && !existingNames.has(template.name),
  );
}
