import type { LegalDocumentType } from "./LegalDocument";
import type { TemplateBlock } from "../template-content";

/** Template dokumen legal milik tenant: kerangka surat berisi blok dan isian. */
export interface LegalTemplateEntity {
  id: string;
  name: string;
  documentType: LegalDocumentType;
  category: { id: string; name: string } | null;
  content: TemplateBlock[];
  isBuiltIn: boolean;
  isActive: boolean;
  tenantId: string | null;
  updatedAt: Date;
}
