import type { PlanningDocument } from "@prisma/client";
import {
  PlanningDocumentEntity,
  type DocumentCategory,
} from "../domain/entities/PlanningDocumentEntity";
import type { PlanningDocumentDTO } from "../dto/PlanningDocumentDTO";

export class PlanningDocumentMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningDocument): PlanningDocumentEntity {
    return new PlanningDocumentEntity({
      id: prisma.id,
      planningId: prisma.planningId,
      tenantId: prisma.tenantId,
      filename: prisma.filename,
      fileUrl: prisma.fileUrl,
      fileSize: prisma.fileSize,
      mimeType: prisma.mimeType,
      category: prisma.category as DocumentCategory,
      description: prisma.description,
      uploadedById: prisma.uploadedById,
      uploadedAt: prisma.uploadedAt,
    });
  }

  /**
   * Convert Entity to DTO
   */
  static toDTO(entity: PlanningDocumentEntity): PlanningDocumentDTO {
    return {
      id: entity.id,
      planningId: entity.planningId,
      filename: entity.filename,
      fileUrl: entity.fileUrl,
      fileSize: entity.fileSize,
      mimeType: entity.mimeType,
      category: entity.category,
      description: entity.description,
      uploadedById: entity.uploadedById,
      uploadedAt: entity.uploadedAt.toISOString(),
      formattedFileSize: entity.getFormattedFileSize(),
      fileExtension: entity.getFileExtension(),
      isImage: entity.isImage(),
    };
  }
}
