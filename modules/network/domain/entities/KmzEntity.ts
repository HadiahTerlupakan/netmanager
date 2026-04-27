export interface KmzFileCreateData {
  name: string;
  filename: string;
  filePath: string;
  kmlPath: string;
  fileSize: number;
  description?: string | null;
  lineColor?: string;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  siteId?: string | null;
}

export interface KmzFileUpdateData {
  name?: string;
  description?: string | null;
  lineColor?: string;
  isActive?: boolean;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  siteId?: string | null;
}

export interface KmzFileEntity {
  id: string;
  name: string;
  filename: string;
  filePath: string;
  kmlPath: string;
  fileSize: number;
  description: string | null;
  lineColor: string;
  isActive: boolean;
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  createdAt: Date;
  updatedAt: Date;
  siteId?: string | null;
}
