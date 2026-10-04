import type { LegalDocumentEntity } from "../domain/entities/LegalDocument";
import type { LegalAccess } from "../domain/ports/ILegalRepository";
import { fillTemplateBlocks, type TemplateBlock } from "../domain/template-content";
import { buildTemplateValues, type TemplateContact } from "../domain/template-values";
import type { CreateLegalDocumentPayload } from "../validators/legal.validator";
import type { TemplateDocumentFields } from "../validators/legal-template.validator";
import { LegalDocumentService, type PartyResolver } from "./LegalDocumentService";
import { LegalPartyDirectory } from "./LegalPartyDirectory";
import { LegalTemplateRenderer } from "./LegalTemplateRenderer";
import { type LetterheadSource, SettingsLetterheadSource } from "./LegalLetterheadSource";

/**
 * Penyusunan dokumen legal dari template: isian otomatis diisi dari data
 * dokumen, kop surat, dan pihak tertaut, lalu dirender menjadi PDF.
 *
 * Penyimpanan diserahkan ke `LegalDocumentService` supaya dokumen dari
 * template melewati validasi dan siklus hidup yang sama dengan unggahan biasa.
 */
export class LegalTemplateDocumentService {
  constructor(
    private readonly renderer: LegalTemplateRenderer = new LegalTemplateRenderer(),
    private readonly letterhead: LetterheadSource = new SettingsLetterheadSource(),
    private readonly parties: PartyResolver = new LegalPartyDirectory(),
    private readonly documents: LegalDocumentService = new LegalDocumentService(),
  ) {}

  /** PDF dari isi template dan data dokumen (boleh belum lengkap — untuk pratinjau). */
  async render(content: TemplateBlock[], fields: TemplateDocumentFields): Promise<Buffer> {
    const [letterhead, party] = await Promise.all([
      this.letterhead.getLetterhead(),
      this.resolveParty(fields),
    ]);
    const values = buildTemplateValues({
      ...fields,
      company: {
        name: letterhead.companyName,
        address: letterhead.address,
        phone: letterhead.phone,
      },
      party,
      today: new Date(),
    });

    return this.renderer.render(fillTemplateBlocks(content, values), letterhead);
  }

  /** Render PDF final lalu catat sebagai dokumen legal baru. */
  async createDocument(
    content: TemplateBlock[],
    payload: CreateLegalDocumentPayload,
    context: { userId: string; access: LegalAccess },
  ): Promise<LegalDocumentEntity> {
    const pdf = await this.render(content, payload);

    return this.documents.create(
      payload,
      { buffer: pdf, fileName: `${payload.title}.pdf`, contentType: "application/pdf" },
      context,
    );
  }

  /** Pihak tertaut memberi alamat & telepon; pihak teks bebas hanya punya nama. */
  private async resolveParty(fields: TemplateDocumentFields): Promise<TemplateContact | null> {
    if (fields.partyType && fields.partyId) {
      const party = await this.parties.findById(fields.partyType, fields.partyId);
      if (party) {
        return { name: fields.partyName || party.name, address: party.address, phone: party.phone };
      }
    }

    return fields.partyName ? { name: fields.partyName, address: null, phone: null } : null;
  }
}
