import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningDocumentRepository,
  CreatePlanningDocumentInput,
  UpdatePlanningDocumentInput,
  FindAllPlanningDocumentFilters,
} from "../domain/ports/IPlanningDocumentRepository";
import type {
  PlanningDocumentEntity,
  DocumentCategory,
} from "../domain/entities/PlanningDocumentEntity";
import { PlanningDocumentMapper } from "../mappers/PlanningDocumentMapper";

export class PlanningDocumentRepository implements IPlanningDocumentRepository {
  /**
   * Find planning document by ID
   */
  async findById(id: string): Promise<PlanningDocumentEntity | null> {
    const document = await prisma.planningDocument.findFirst({
      where: { id },
    });

    return document ? PlanningDocumentMapper.toEntity(document) : null;
  }

  /**
   * Find all planning documents with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningDocumentFilters,
  ): Promise<{ items: PlanningDocumentEntity[]; total: number }> {
    const { tenantId, planningId, category, page = 1, limit = 50 } = filters;

    const where: Prisma.PlanningDocumentWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (planningId) {
      where.planningId = planningId;
    }
    if (category) {
      where.category = category;
    }

    const [documents, total] = await Promise.all([
      prisma.planningDocument.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningDocument.count({ where }),
    ]);

    return {
      items: documents.map((doc) => PlanningDocumentMapper.toEntity(doc)),
      total,
    };
  }

  /**
   * Find all documents for a specific planning
   */
  async findByPlanningId(
    planningId: string,
  ): Promise<PlanningDocumentEntity[]> {
    const documents = await prisma.planningDocument.findMany({
      where: { planningId },
      orderBy: { uploadedAt: "desc" },
    });

    return documents.map((doc) => PlanningDocumentMapper.toEntity(doc));
  }

  /**
   * Find documents by category for a specific planning
   */
  async findByCategory(
    planningId: string,
    category: DocumentCategory,
  ): Promise<PlanningDocumentEntity[]> {
    const documents = await prisma.planningDocument.findMany({
      where: {
        planningId,
        category,
      },
      orderBy: { uploadedAt: "desc" },
    });

    return documents.map((doc) => PlanningDocumentMapper.toEntity(doc));
  }

  /**
   * Create new planning document
   */
  async create(
    data: CreatePlanningDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningDocumentEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningDocumentUncheckedCreateInput = {
      planningId: data.planningId,
      tenantId: data.tenantId,
      filename: data.filename,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize ?? null,
      mimeType: data.mimeType ?? null,
      category: data.category,
      description: data.description ?? null,
      uploadedById: data.uploadedById ?? null,
    };

    const created = await client.planningDocument.create({
      data: prismaData,
    });

    return PlanningDocumentMapper.toEntity(created);
  }

  /**
   * Update planning document
   */
  async update(
    id: string,
    data: UpdatePlanningDocumentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningDocumentEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningDocumentUpdateInput = {};

    if (data.filename !== undefined) {
      updateData.filename = data.filename;
    }
    if (data.fileUrl !== undefined) {
      updateData.fileUrl = data.fileUrl;
    }
    if (data.fileSize !== undefined) {
      updateData.fileSize = data.fileSize;
    }
    if (data.mimeType !== undefined) {
      updateData.mimeType = data.mimeType;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    const updated = await client.planningDocument.update({
      where: { id },
      data: updateData,
    });

    return PlanningDocumentMapper.toEntity(updated);
  }

  /**
   * Delete planning document
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningDocument.delete({
      where: { id },
    });
  }
}
