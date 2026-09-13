export type NotificationType =
  | "WORK_ORDER"
  | "SYSTEM"
  | "TICKET"
  | "ALERT"
  | "ANNOUNCEMENT"
  | "HOLIDAY_CREATED"
  | "PACKAGE_UPGRADE";

export interface PackageUpgradeNotificationData {
  customerId: string;
  customerName: string;
  currentPackageName: string;
  targetPackageName: string;
  applyAt: Date;
  siteId?: string | null;
  tenantId?: string | null;
}

export interface PackageUpgradeCancelledNotificationData {
  customerId: string;
  customerName: string;
  targetPackageName: string;
  siteId?: string | null;
  tenantId?: string | null;
}

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface CreateNotificationData {
  type: NotificationType;
  priority?: NotificationPriority | undefined;
  title: string;
  message: string;
  link?: string | undefined;
  userId?: string | undefined;
  departmentId?: string | undefined;
  siteId?: string | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  skipExpoPush?: boolean | undefined;
  tenantId?: string | undefined;
}

export interface WorkOrderNotificationData {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string | undefined;
  siteId?: string | undefined;
  assignedToId?: string | undefined;
  createdById?: string | undefined;
  requestedById?: string | undefined;
  tenantId?: string | undefined;
}

export interface CanvasingNotificationData {
  canvasingId: string;
  customerName: string;
  salesId: string;
  salesName?: string;
  siteId?: string | null;
}

export interface PointClaimNotificationData {
  claimId: string;
  canvasingId: string;
  customerName: string;
  salesId: string;
  salesName?: string;
  pointValue: number;
  siteId?: string | null;
}
