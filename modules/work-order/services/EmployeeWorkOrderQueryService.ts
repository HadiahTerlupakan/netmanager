import type { WorkOrderStatus } from "@prisma/client";
import type { WorkOrderWithRelations } from "../repositories/IWorkOrderRepository";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { validateMobileAssignedWorkOrderAccess } from "./work-order-access";

const ACTIVE_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
] as const;
const HISTORY_WORK_ORDER_STATUSES = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;
const MOBILE_DETAIL_STATUSES = [
  "REQUESTED",
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;

interface MobileWorkOrderUserContext {
  id: string;
  name?: string;
  role?: string;
  siteId?: string;
  tenantId?: string;
  isSuperAdmin: boolean;
}

export class EmployeeWorkOrderQueryService {
  constructor(private readonly repository = new WorkOrderRepository()) {}

  /** Mengambil daftar work order yang ditugaskan ke user. */
  async getAssignedWorkOrders(userId: string) {
    return this.repository.findAllForList({ assignedToId: userId });
  }

  /** Mengambil daftar work order mobile berdasarkan tipe tab. */
  async getMobileWorkOrders(
    userId: string,
    type: string,
    page: number,
    limit: number,
  ) {
    const status = this.resolveMobileStatuses(type);
    return this.repository.findAllForList(
      { involvedUserId: userId, status },
      page,
      limit,
    );
  }

  /** Mengambil detail work order mobile dengan validasi akses. */
  async getMobileWorkOrderDetail(
    workOrderId: string,
    userContext: MobileWorkOrderUserContext,
  ) {
    return validateMobileAssignedWorkOrderAccess({
      repository: this.repository,
      workOrderId,
      userContext: this.buildAccessContext(userContext),
      allowedStatuses: [...MOBILE_DETAIL_STATUSES],
      invalidStatusMessage: "Work order tidak dapat diakses pada status ini",
    });
  }

  /** Membangun konteks akses mobile yang konsisten. */
  private buildAccessContext(userContext: MobileWorkOrderUserContext) {
    return {
      id: userContext.id,
      name: userContext.name,
      role: userContext.role,
      permissions: [] as string[],
      siteId: userContext.siteId,
      tenantId: userContext.tenantId,
      isSuperAdmin: userContext.isSuperAdmin,
    };
  }

  /** Menentukan status filter mobile berdasarkan tipe tab. */
  private resolveMobileStatuses(type: string): WorkOrderStatus[] {
    if (type === "active") {
      return [...ACTIVE_WORK_ORDER_STATUSES];
    }

    return [...HISTORY_WORK_ORDER_STATUSES];
  }
}

export type MobileWorkOrderDetail = WorkOrderWithRelations;
export const employeeWorkOrderQueryService =
  new EmployeeWorkOrderQueryService();
