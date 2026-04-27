export interface WorkOrderPelangganEntity {
  id: string;
  nama: string;
  alamat: string | null;
  noTelp: string | null;
}

export interface WorkOrderSiteEntity {
  id: string;
  name: string;
  address: string | null;
}

export interface WorkOrderDepartmentEntity {
  id: string;
  name: string;
}

export interface AvailableWorkOrderEntity {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  contactName: string | null;
  contactPhone: string | null;
  locationAddress: string | null;
  scheduledDate: Date | null;
  createdAt: Date;
  tenantId: string | null;
  siteId: string | null;
  departmentId: string | null;
  assignedToId: string | null;
  assignedMitraId: string | null;
  pelanggan: WorkOrderPelangganEntity | null;
  site: WorkOrderSiteEntity | null;
  department: WorkOrderDepartmentEntity | null;
}

export interface MobileAvailableUserProfileEntity {
  departmentId: string | null;
  siteId: string | null;
  name: string | null;
  userSites: Array<{ siteId: string }>;
}

export interface MobileAvailableMitraProfileEntity {
  name: string;
  siteId: string | null;
}
