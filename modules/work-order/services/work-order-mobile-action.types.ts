import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";

export type MobileWorkOrderAction =
  | "START"
  | "CLAIM"
  | "COMPLETE"
  | "PAUSE"
  | "COMMENT"
  | "NOTE";

export type WorkOrderUpdateType =
  | "COMMENT"
  | "NOTE"
  | "STATUS_CHANGE"
  | "PROGRESS_UPDATE"
  | "PHOTO";

export type MitraWalletServiceContract = {
  addEarning: (
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: "WORK_ORDER",
  ) => Promise<unknown>;
  deductBalance: (
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: "WORK_ORDER",
  ) => Promise<unknown>;
};

export type MobileActionPayload = {
  action: MobileWorkOrderAction;
  notes?: string;
  photo?: File;
  photos?: File[];
  photoUrl?: string;
  photoUrls?: string[];
  latitude?: string | number;
  longitude?: string | number;
  locationName?: string;
  timestamp?: string;
};

export interface MobileUserContext {
  id: string;
  name?: string;
  role?: string;
  siteId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

export interface HandleTaskUpdateInput {
  workOrderId: string;
  taskId: string;
  isCompleted: boolean;
  tenantId: string;
  actor: MobileUserContext;
}

export interface HandleMobileActionInput {
  workOrderId: string;
  tenantId: string;
  actor: MobileUserContext;
  payload: MobileActionPayload;
}

export type WorkOrderDetail = Awaited<
  ReturnType<WorkOrderRepository["findById"]>
>;

export interface MobileActionContext {
  actorName: string;
  timestamp?: Date;
  locationLabel: string;
  ticketNumber: string;
  workOrderId: string;
}

export interface WorkOrderActionExecutionInput {
  input: HandleMobileActionInput;
  workOrder: WorkOrderDetail;
  actionContext: MobileActionContext;
  userIdForDb?: string;
}
