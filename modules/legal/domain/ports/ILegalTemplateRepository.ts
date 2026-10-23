import type { LegalDocumentType } from "../entities/LegalDocument";
import type { LegalTemplateEntity } from "../entities/LegalTemplate";
import type { TemplateBlock } from "../template-content";

/** Kontrak akses data template dokumen legal. */

export interface LegalTemplateInput {
  name: string;
  documentType: LegalDocumentType;
  categoryId?: string | null;
  content: TemplateBlock[];
  isBuiltIn?: boolean;
  tenantId: string | null;
}

export type LegalTemplatePatch = Partial<
  Pick<LegalTemplateInput, "name" | "categoryId" | "content"> & { isActive: boolean }
>;

export interface ILegalTemplateRepository {
  countTemplates(): Promise<number>;
  createTemplates(inputs: LegalTemplateInput[]): Promise<void>;
  listTemplates(): Promise<LegalTemplateEntity[]>;
  findTemplateById(id: string): Promise<LegalTemplateEntity | null>;
  createTemplate(input: LegalTemplateInput): Promise<LegalTemplateEntity>;
  updateTemplate(id: string, patch: LegalTemplatePatch): Promise<LegalTemplateEntity>;
}
