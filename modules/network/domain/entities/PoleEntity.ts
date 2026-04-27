export interface PoleCreateData {
  name: string;
  images?: string[];
  location?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  cableSlack?: boolean;
  siteId?: string | null;
}

export interface PoleUpdateData {
  name?: string;
  images?: string[];
  location?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  cableSlack?: boolean;
  siteId?: string | null;
}

export interface PoleEntity {
  id: string;
  name: string;
  images: string[];
  location: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE";
  cableSlack: boolean;
  createdAt: Date;
  updatedAt: Date;
  siteId: string | null;
}
