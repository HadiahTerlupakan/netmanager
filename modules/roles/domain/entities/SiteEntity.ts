export interface SiteGudangEntity {
  id: string;
  name: string;
}

export interface SiteUserSummaryEntity {
  id: string;
  name: string | null;
  email: string;
  departmentName: string | null;
}

export interface SiteCountsEntity {
  users: number;
  workOrders: number;
  pelanggan: number;
}

export interface SiteLocationEntity {
  latitude: number | null;
  longitude: number | null;
  attendanceRadius: number;
}

export interface SiteEntity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  isActive: boolean;
  location: SiteLocationEntity;
  gudangs: SiteGudangEntity[];
  users: SiteUserSummaryEntity[];
  counts: SiteCountsEntity;
  createdAt: Date;
  updatedAt: Date;
}
