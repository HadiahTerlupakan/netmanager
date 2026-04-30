export type WorkOrderStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "VERIFIED"
  | "CLOSED"
  | "CANCELLED"
  | "REQUESTED";

export type WorkOrderPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT"
  | "CRITICAL";

export type WorkOrderType =
  | "INSTALLATION"
  | "TROUBLESHOOT"
  | "MAINTENANCE"
  | "UPGRADE"
  | "RELOCATION"
  | "DISCONNECTION"
  | "OTHER";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface WorkOrderEntity {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string | null;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  tenantId: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  slaId: string | null;
  warrantyOwnerId: string | null;
  isWarranty: boolean;
  pelangganId: string | null;
  siteId: string | null;
  departmentId: string | null;
  assignedToId: string | null;
  assignedMitraId: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  contactName: string | null;
  contactPhone: string | null;
  scheduledDate: Date | null;
  scheduledTimeStart: string | null;
  scheduledTimeEnd: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  requiredMaterials: JsonValue;
  usedMaterials: JsonValue;
  returnedMaterials: JsonValue;
  templateId: string | null;
  requestedAt: Date | null;
  heldAt: Date | null;
  holdReason: string | null;
  resumedAt: Date | null;
  warrantySla: Date | null;
  internalNotes: string | null;
  resolutionNotes: string | null;
  customerFeedback: string | null;
  rating: number | null;
  disconnectionReason: string | null;
  ticketId: string | null;
  isInternal: boolean;
  requestedById: string | null;
  createdById: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  verifiedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrderTaskEntity {
  id: string;
  tenantId: string | null;
  workOrderId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  completedAt: Date | null;
  completedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrderAssignmentEntity {
  id: string;
  workOrderId: string;
  userId: string;
  role: string | null;
  status?: string;
  mitraId?: string | null;
  assignedAt: Date;
  respondedAt?: Date | null;
  assignedById?: string | null;
  isLead?: boolean;
  unassignedAt?: Date | null;
}

export interface WorkOrderUpdateEntity {
  id: string;
  workOrderId: string;
  updateType: string;
  message: string;
  oldStatus: WorkOrderStatus | null;
  newStatus: WorkOrderStatus | null;
  createdById: string | null;
  createdAt: Date;
}

export interface WorkOrderAttachmentEntity {
  id: string;
  workOrderId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  caption: string | null;
  uploadedById: string | null;
  uploadedAt?: Date;
  createdAt?: Date;
}

export interface WorkOrderMaterialEntity {
  id: string;
  workOrderId: string;
  inventoryItemId?: string | null;
  barangId?: string | null;
  itemName?: string;
  quantity: number;
  unit?: string | null;
  cost?: number | null;
  satuan: string | null;
  notes: string | null;
  barang?:
    | {
        id?: string;
        name: string;
        kodeBarang: string;
      }
    | {
        id?: string;
        nama: string;
        kode: string;
        satuan?: string;
      }
    | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkOrderPelangganEntity {
  id: string;
  idPelanggan?: string;
  nama: string;
  email?: string | null;
  alamat?: string | null;
  noTelp: string | null;
}

export interface WorkOrderSiteEntity {
  id: string;
  code?: string;
  name: string;
  address?: string | null;
}

export interface WorkOrderDepartmentEntity {
  id: string;
  name: string;
}

export interface WorkOrderUserEntity {
  id: string;
  name: string | null;
  email?: string | null;
}

export interface WorkOrderMitraEntity {
  id: string;
  name: string;
  email: string;
}

export interface WorkOrderWithRelations extends WorkOrderEntity {
  pelanggan?: WorkOrderPelangganEntity | null;
  site?: WorkOrderSiteEntity | null;
  department?: WorkOrderDepartmentEntity | null;
  assignedTo?: WorkOrderUserEntity | null;
  assignedMitra?: WorkOrderMitraEntity | null;
  tasks?: WorkOrderTaskEntity[];
  assignments?: Array<
    WorkOrderAssignmentEntity & { user: WorkOrderUserEntity }
  >;
  updates?: Array<
    WorkOrderUpdateEntity & { user?: WorkOrderUserEntity | null }
  >;
  attachments?: WorkOrderAttachmentEntity[];
  materials?: WorkOrderMaterialEntity[];
  ticket?: { ticketNumber: string } | null;
  createdBy?: WorkOrderUserEntity | null;
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
