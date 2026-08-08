export type DocumentCategory =
  | "SURVEY_PHOTO"
  | "NETWORK_DIAGRAM"
  | "TECHNICAL_DRAWING"
  | "APPROVAL_DOCUMENT"
  | "COMPLETION_PHOTO"
  | "OTHER";

export interface PlanningDocumentEntityProps {
  id: string;
  planningId: string;
  tenantId: string;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  category: DocumentCategory;
  description: string | null;
  uploadedById: string | null;
  uploadedAt: Date;
}

/**
 * PlanningDocumentEntity represents a document or file attached to a planning record,
 * such as survey photos, technical drawings, or approval documents.
 */
export class PlanningDocumentEntity {
  readonly id: string;
  readonly planningId: string;
  readonly tenantId: string;
  readonly filename: string;
  readonly fileUrl: string;
  readonly fileSize: number | null;
  readonly mimeType: string | null;
  readonly category: DocumentCategory;
  readonly description: string | null;
  readonly uploadedById: string | null;
  readonly uploadedAt: Date;

  constructor(props: PlanningDocumentEntityProps) {
    this.id = props.id;
    this.planningId = props.planningId;
    this.tenantId = props.tenantId;
    this.filename = props.filename;
    this.fileUrl = props.fileUrl;
    this.fileSize = props.fileSize;
    this.mimeType = props.mimeType;
    this.category = props.category;
    this.description = props.description;
    this.uploadedById = props.uploadedById;
    this.uploadedAt = props.uploadedAt;
  }

  /**
   * Check if document is an image file
   */
  isImage(): boolean {
    if (!this.mimeType) {
      return false;
    }
    return this.mimeType.startsWith("image/");
  }

  /**
   * Check if document is a PDF file
   */
  isPDF(): boolean {
    return this.mimeType === "application/pdf";
  }

  /**
   * Get file size in megabytes
   */
  getFileSizeInMB(): number | null {
    if (this.fileSize === null) {
      return null;
    }
    return this.fileSize / (1024 * 1024);
  }

  /**
   * Get file size in kilobytes
   */
  getFileSizeInKB(): number | null {
    if (this.fileSize === null) {
      return null;
    }
    return this.fileSize / 1024;
  }

  /**
   * Get formatted file size with appropriate unit
   */
  getFormattedFileSize(): string | null {
    if (this.fileSize === null) {
      return null;
    }

    if (this.fileSize < 1024) {
      return `${this.fileSize} B`;
    }

    const kb = this.fileSize / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }

    const mb = kb / 1024;
    if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    }

    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(): string | null {
    const parts = this.filename.split(".");
    if (parts.length < 2) {
      return null;
    }
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Check if document is a photo category
   */
  isPhotoCategory(): boolean {
    return (
      this.category === "SURVEY_PHOTO" || this.category === "COMPLETION_PHOTO"
    );
  }

  /**
   * Check if document is a technical document
   */
  isTechnicalDocument(): boolean {
    return (
      this.category === "NETWORK_DIAGRAM" ||
      this.category === "TECHNICAL_DRAWING"
    );
  }
}
