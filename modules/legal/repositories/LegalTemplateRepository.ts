import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { LegalDocumentType } from "../domain/entities/LegalDocument";
import type { LegalTemplateEntity } from "../domain/entities/LegalTemplate";
import type {
  ILegalTemplateRepository,
  LegalTemplateInput,
  LegalTemplatePatch,
} from "../domain/ports/ILegalTemplateRepository";
import type { TemplateBlock } from "../domain/template-content";
import { withDuplicateNameGuard } from "./prisma-errors";

/** Akses data template legal lewat klien Prisma ber-ekstensi isolasi tenant. */

const templateInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.LegalTemplateInclude;

type LegalTemplateRow = Prisma.LegalTemplateGetPayload<{ include: typeof templateInclude }>;

const withDuplicateTemplateGuard = <T>(write: () => Promise<T>) =>
  withDuplicateNameGuard("Nama template sudah dipakai", write);

/** Isi JSON sudah divalidasi saat ditulis, jadi aman dikembalikan sebagai blok. */
function toLegalTemplateEntity(row: LegalTemplateRow): LegalTemplateEntity {
  return {
    id: row.id,
    name: row.name,
    documentType: row.documentType as LegalDocumentType,
    category: row.category,
    content: row.content as unknown as TemplateBlock[],
    isBuiltIn: row.isBuiltIn,
    isActive: row.isActive,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt,
  };
}

const toJson = (content: TemplateBlock[]) => content as unknown as Prisma.InputJsonValue;

export class LegalTemplateRepository implements ILegalTemplateRepository {
  countTemplates(): Promise<number> {
    return prisma.legalTemplate.count();
  }

  async createTemplates(inputs: LegalTemplateInput[]): Promise<void> {
    await prisma.legalTemplate.createMany({
      data: inputs.map((input) => ({ ...input, content: toJson(input.content) })),
      skipDuplicates: true,
    });
  }

  async listTemplates(): Promise<LegalTemplateEntity[]> {
    const rows = await prisma.legalTemplate.findMany({
      include: templateInclude,
      orderBy: [{ documentType: "asc" }, { name: "asc" }],
    });
    return rows.map(toLegalTemplateEntity);
  }

  async findTemplateById(id: string): Promise<LegalTemplateEntity | null> {
    const row = await prisma.legalTemplate.findFirst({ where: { id }, include: templateInclude });
    return row ? toLegalTemplateEntity(row) : null;
  }

  async createTemplate(input: LegalTemplateInput): Promise<LegalTemplateEntity> {
    const row = await withDuplicateTemplateGuard(() =>
      prisma.legalTemplate.create({
        data: { ...input, content: toJson(input.content) },
        include: templateInclude,
      }),
    );
    return toLegalTemplateEntity(row);
  }

  async updateTemplate(id: string, patch: LegalTemplatePatch): Promise<LegalTemplateEntity> {
    const { content, ...rest } = patch;
    const row = await withDuplicateTemplateGuard(() =>
      prisma.legalTemplate.update({
        where: { id },
        data: { ...rest, ...(content ? { content: toJson(content) } : {}) },
        include: templateInclude,
      }),
    );
    return toLegalTemplateEntity(row);
  }
}
