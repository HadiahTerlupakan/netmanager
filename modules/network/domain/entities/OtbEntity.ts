export interface OtbCoreData {
  idx: number;
  slotName: string;
  tubeColor: string;
  coreColor: string;
}

export interface OtbCreateData {
  name: string;
  images?: string[];
  location?: string | null;
  coreCount: number;
  notes?: string | null;
  keteranganJumlahKabelFeeder?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
  cores?: OtbCoreData[];
  siteId?: string | null;
}

export interface OtbUpdateData {
  name?: string;
  images?: string[];
  location?: string | null;
  coreCount?: number;
  notes?: string | null;
  keteranganJumlahKabelFeeder?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
  cores?: OtbCoreData[];
  siteId?: string | null;
}

export interface OtbEntity {
  id: string;
  name: string;
  images: string[];
  location: string | null;
  coreCount: number;
  notes: string | null;
  keteranganJumlahKabelFeeder: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
  createdAt: Date;
  updatedAt: Date;
  siteId: string | null;
}
