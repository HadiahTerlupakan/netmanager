import type { Prisma } from "@prisma/client";
import type {
  PlanningDocumentEntity,
  DocumentCategory,
} from "../entities/PlanningDocumentEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningDocumentInput {
  planningId: string;
  tenantId: string;
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  category: DocumentCategory;
  description?: string | null;
  uploadedById?: string | null;
}

export interface UpdatePlanningDocumentInput {
  filename?: string;
  fileUrl?: string;
  fileSize?: number | null;
  mimeType?: string | null;
  category?: DocumentCategory;
  description?: string | null;
}

export interface FindAllPlanningDocumentFilters {
  tenantId?: string | null;
  planningId?: string;
  category?: DocumentCategory;
  page?: number;
  limit?: number;
}

export interface IPlanningDocumentRepository {
  /**
   * Find planning document by ID
   */
  findById(id: string): Promise<PlanningDocumentEntity | null>;

  /**
   * Find all planning documents with filters and pagination
   */
  findAll(
    filters: FindAllPlanningDocumentFilters,
  ): Promise<{ items: PlanningDocumentEntity[]; total: number }>;

  /**
   * Find all documents for a specific planning
   */
  findByPlanningId(planningId: string): Promise<PlanningDocumentEntity[]>;

  /**
   * Find documents by category for a specific planning
   */
  findByCategory(
    planningId: string,
    category: DocumentCategory,
  ): Promise<PlanningDocumentEntity[]>;

  /**
   * Create new planning document
   */
  create(
    data: CreatePlanningDocumentInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningDocumentEntity>;

  /**
   * Update planning document
   */
  update(
    id: string,
    data: UpdatePlanningDocumentInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningDocumentEntity>;

  /**
   * Delete planning document
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
