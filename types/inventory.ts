// Photo metadata types for inventory system
export interface PhotoMetadata {
  url: string;
  filename: string;
  size: number; // File size in bytes
  format: string; // File format (e.g., 'jpg', 'png', 'webp')
  uploadedAt: string; // ISO timestamp
  uploadedBy?: string; // User ID who uploaded the photo
  caption?: string; // Optional caption for the photo
}

// Type for fotoMetadata field in database
export type FotoMetadataJson = Record<string, PhotoMetadata>;