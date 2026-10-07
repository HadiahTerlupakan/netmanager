import type {
  WorkOrderStatus,
  WorkOrderType,
} from "../entities/WorkOrderEntity";

/** Data minimal work order untuk menghitung standar mutu layanan. */
export interface ServiceLevelWorkOrderRecord {
  id: string;
  workOrderNumber: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  siteId: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
}

export interface ServiceLevelWorkOrderQuery {
  tenantId: string;
  types: WorkOrderType[];
  /** Rentang waktu work order dibuat: [from, to). */
  from: Date;
  to: Date;
  /** Batasi ke site tertentu; `undefined` = seluruh site tenant. */
  siteIds?: string[];
}

/** Port baca work order untuk laporan mutu layanan. */
export interface IWorkOrderServiceLevelRepository {
  findForServiceLevel(
    query: ServiceLevelWorkOrderQuery,
  ): Promise<ServiceLevelWorkOrderRecord[]>;
}
