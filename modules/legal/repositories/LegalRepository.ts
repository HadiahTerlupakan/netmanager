import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/modules/database";
import type {
  LegalCategoryEntity,
  LegalDocumentStatus,
} from "../domain/entities/LegalDocument";
import { SOON_WINDOW_DAYS, wibDayStart } from "../domain/legal-rules";
import type {
  CreateLegalDocumentInput,
  ILegalRepository,
  LegalAccess,
  LegalCategoryInput,
  LegalDocumentFields,
  LegalDocumentFilters,
  LegalFileFields,
  LegalObligationInput,
} from "../domain/ports/ILegalRepository";
import {
  legalDocumentInclude,
  toLegalCategoryEntity,
  toLegalDocumentEntity,
} from "../mappers/legal.mapper";

/**
 * Akses data modul legal lewat klien Prisma ber-ekstensi isolasi tenant.
 * Kategori rahasia disaring di sini untuk setiap jalur baca dokumen.
 */

const PRISMA_UNIQUE_VIOLATION = "P2002";

function confidentialityWhere(access: LegalAccess): Prisma.LegalDocumentWhereInput {
  if (access.canViewConfidential) return {};

  return { OR: [{ categoryId: null }, { category: { confidentiality: "BIASA" } }] };
}

const MONITORED: Prisma.LegalDocumentWhereInput = {
  terminatedAt: null,
  renewedBy: { is: null },
};

/** Terjemahan status turunan ke kondisi tanggal, sejalan dengan `deriveStatus`. */
function statusWhere(
  status: LegalDocumentStatus,
  now: Date,
): Prisma.LegalDocumentWhereInput {
  const todayStart = wibDayStart(now);
  const soonEnd = wibDayStart(now, SOON_WINDOW_DAYS + 1);

  switch (status) {
    case "DIAKHIRI":
      return { terminatedAt: { not: null } };
    case "DIPERPANJANG":
      return { terminatedAt: null, renewedBy: { isNot: null } };
    case "KEDALUWARSA":
      return { ...MONITORED, endDate: { lt: todayStart } };
    case "SEGERA_BERAKHIR":
      return { ...MONITORED, endDate: { gte: todayStart, lt: soonEnd } };
    case "AKTIF":
      return { ...MONITORED, OR: [{ endDate: null }, { endDate: { gte: soonEnd } }] };
  }
}

function searchWhere(search: string | undefined): Prisma.LegalDocumentWhereInput {
  if (!search) return {};

  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { documentNumber: { contains: search, mode: "insensitive" } },
      { partyName: { contains: search, mode: "insensitive" } },
    ],
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_VIOLATION
  );
}

/** Nama kategori unik per tenant; bentrok diterjemahkan ke 409, bukan 500. */
async function withDuplicateCategoryGuard<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Nama kategori sudah dipakai", 409, "DUPLICATE");
    }
    throw error;
  }
}

function toObligationRows(obligations: LegalObligationInput[], tenantId: string | null) {
  return obligations.map((obligation) => ({ ...obligation, tenantId }));
}

export class LegalRepository implements ILegalRepository {
  async countCategories(): Promise<number> {
    return prisma.legalCategory.count();
  }

  async createCategories(inputs: LegalCategoryInput[]): Promise<void> {
    await prisma.legalCategory.createMany({ data: inputs, skipDuplicates: true });
  }

  async listCategories(access: LegalAccess): Promise<LegalCategoryEntity[]> {
    const rows = await prisma.legalCategory.findMany({
      where: access.canViewConfidential ? {} : { confidentiality: "BIASA" },
      orderBy: [{ documentType: "asc" }, { name: "asc" }],
    });

    return rows.map(toLegalCategoryEntity);
  }

  async findCategoryById(id: string, access: LegalAccess) {
    const row = await prisma.legalCategory.findFirst({
      where: { id, ...(access.canViewConfidential ? {} : { confidentiality: "BIASA" }) },
    });

    return row ? toLegalCategoryEntity(row) : null;
  }

  async createCategory(input: LegalCategoryInput) {
    return toLegalCategoryEntity(
      await withDuplicateCategoryGuard(() => prisma.legalCategory.create({ data: input })),
    );
  }

  async updateCategory(
    id: string,
    data: Partial<Pick<LegalCategoryEntity, "name" | "confidentiality" | "isActive">>,
  ) {
    return toLegalCategoryEntity(
      await withDuplicateCategoryGuard(() =>
        prisma.legalCategory.update({ where: { id }, data }),
      ),
    );
  }

  async findDocuments(filters: LegalDocumentFilters, access: LegalAccess) {
    const where: Prisma.LegalDocumentWhereInput = {
      AND: [
        confidentialityWhere(access),
        searchWhere(filters.search),
        filters.status ? statusWhere(filters.status, filters.now) : {},
        filters.documentType ? { documentType: filters.documentType } : {},
        filters.categoryId ? { categoryId: filters.categoryId } : {},
      ],
    };

    const [rows, total] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        include: legalDocumentInclude,
        orderBy: [{ endDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.legalDocument.count({ where }),
    ]);

    return { items: rows.map(toLegalDocumentEntity), total };
  }

  async findDocumentById(id: string, access: LegalAccess) {
    const row = await prisma.legalDocument.findFirst({
      where: { AND: [{ id }, confidentialityWhere(access)] },
      include: legalDocumentInclude,
    });

    return row ? toLegalDocumentEntity(row) : null;
  }

  async createDocument(input: CreateLegalDocumentInput) {
    const { obligations, ...fields } = input;
    const row = await prisma.legalDocument.create({
      data: {
        ...fields,
        obligations: { create: toObligationRows(obligations, input.tenantId) },
      },
      include: legalDocumentInclude,
    });

    return toLegalDocumentEntity(row);
  }

  async updateDocument(
    id: string,
    fields: Partial<LegalDocumentFields>,
    obligations: LegalObligationInput[] | undefined,
    tenantId: string | null,
  ) {
    const row = await prisma.$transaction(async (tx) => {
      if (obligations) {
        await tx.legalObligation.deleteMany({ where: { documentId: id } });
        await tx.legalObligation.createMany({
          data: toObligationRows(obligations, tenantId).map((item) => ({
            ...item,
            documentId: id,
          })),
        });
      }

      return tx.legalDocument.update({
        where: { id },
        data: fields,
        include: legalDocumentInclude,
      });
    });

    return toLegalDocumentEntity(row);
  }

  async terminateDocument(id: string, reason: string, at: Date): Promise<void> {
    await prisma.legalDocument.update({
      where: { id },
      data: { terminatedAt: at, terminationReason: reason },
    });
  }

  async findMonitoredDocuments(access: LegalAccess) {
    const rows = await prisma.legalDocument.findMany({
      where: {
        AND: [
          MONITORED,
          confidentialityWhere(access),
          {
            OR: [
              { endDate: { not: null } },
              { guaranteeEndDate: { not: null } },
              { obligations: { some: {} } },
            ],
          },
        ],
      },
      include: legalDocumentInclude,
    });

    return rows.map(toLegalDocumentEntity);
  }

  async linkEndorsement(documentId: string, endorsementId: string): Promise<void> {
    await prisma.legalDocument.update({
      where: { id: documentId },
      data: { endorsementId },
    });
  }

  async replaceFile(documentId: string, file: LegalFileFields): Promise<void> {
    await prisma.legalDocument.update({ where: { id: documentId }, data: file });
  }

  async findDocumentIdByEndorsement(endorsementId: string): Promise<string | null> {
    const row = await prisma.legalDocument.findFirst({
      where: { endorsementId },
      select: { id: true },
    });

    return row?.id ?? null;
  }

  async recordReminder(input: {
    documentId: string;
    deadlineKey: string;
    threshold: string;
    tenantId: string | null;
  }): Promise<boolean> {
    try {
      await prisma.legalReminderLog.create({ data: input });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }
}
