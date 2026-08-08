import type { DocumentCategory } from "../domain/entities/PlanningDocumentEntity";

/**
 * PlanningDocumentDTO - Document metadata for API responses
 */
export interface PlanningDocumentDTO {
  id: string;
  planningId: string;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  category: DocumentCategory;
  description: string | null;
  uploadedById: string | null;
  uploadedAt: string;

  // Computed fields
  formattedFileSize: string | null;
  fileExtension: string | null;
  isImage: boolean;
}

/**
 * UploadPlanningDocumentDTO - Request payload for uploading document
 */
export interface UploadPlanningDocumentDTO {
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  category: DocumentCategory;
  description?: string | null;
}
