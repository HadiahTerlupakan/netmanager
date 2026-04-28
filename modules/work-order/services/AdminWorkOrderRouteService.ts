import { createNotification, sendPushToUsers } from "@/modules/notification";
import {
  onWorkOrderUpdated,
  sendWorkOrderReminder,
} from "./WorkOrderNotifications";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import type { UserContext } from "./WorkOrderService";
import { getWorkOrderService } from "./WorkOrderService";
import { logger, logActivitySafe } from "@/lib/logger";
import { workOrderCacheService } from "./WorkOrderCacheService";
import { isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_TOP_LIMIT = 5;
const LAST_30_DAYS = 30;
const WORK_ORDER_REMINDER_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;
const CANCEL_REASON_DEFAULT = "Cancelled by admin";

type PermissionList = string[] | undefined;
type WorkOrderRequestAction = "APPROVE" | "REJECT";

type WorkOrderListRouteFilters = Record<string, string | string[] | boolean>;

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

interface WorkOrderApprovalInput {
  workOrderId: string;
  action: WorkOrderRequestAction;
  actor: { id: string; role?: string; name?: string | null };
  permissions?: PermissionList;
  reason?: string;
}

/** Service route admin untuk orkestrasi work order tanpa akses database di route. */
export class AdminWorkOrderRouteService {
  private readonly repository = new AdminWorkOrderRouteRepository();

  private get workOrderService() {
    return getWorkOrderService();
  }

  /** Ambil user context lengkap untuk route admin. */
  async getUserContext(
    user: {
      id: string;
      role?: string;
      name?: string | null;
    },
    permissions?: PermissionList,
  ): Promise<UserContext | null> {
    const profile = await this.repository.findUserProfile(user.id);

    if (!profile) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      name: user.name || undefined,
      permissions,
      siteId: profile.siteId || undefined,
      departmentId: profile.departmentId || undefined,
    };
  }

  /** Ambil filter akses department/site berdasarkan permissions admin. */
  async buildAccessFilters(
    user: { id: string; role?: string },
    permissions?: PermissionList,
  ) {
    const profile = await this.repository.findUserProfile(user.id);

    if (!profile) {
      return { unauthorized: true as const };
    }

    const permissionList = permissions || [];
    const isSuper = isSuperAdmin({ role: user.role });
    const hasDepartmentRestriction = permissionList.includes(
      "workorders:department_only",
    );
    const hasSiteRestriction = permissionList.includes("workorders:site_only");

    if (hasDepartmentRestriction && !isSuper && !profile.departmentId) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    if (hasSiteRestriction && !isSuper && !profile.siteId) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    return {
      unauthorized: false as const,
      emptyResponse: false as const,
      departmentId:
        hasDepartmentRestriction && !isSuper
          ? profile.departmentId || undefined
          : undefined,
      siteId:
        hasSiteRestriction && !isSuper
          ? profile.siteId || undefined
          : undefined,
      userDepartmentId: profile.departmentId || undefined,
      userSiteId: profile.siteId || undefined,
    };
  }

  /** Bangun filter list work order dari query string route admin. */
  buildListFilters(searchParams: URLSearchParams): WorkOrderListRouteFilters {
    const filters: WorkOrderListRouteFilters = {};

    this.assignListFilterValue(filters, "status", searchParams.get("status"));
    this.assignListFilterValue(
      filters,
      "priority",
      searchParams.get("priority"),
    );
    this.assignListFilterValue(filters, "type", searchParams.get("type"));
    this.assignScalarFilter(
      filters,
      "departmentId",
      searchParams.get("departmentId"),
    );
    this.assignScalarFilter(filters, "siteId", searchParams.get("siteId"));
    this.assignScalarFilter(
      filters,
      "assignedToId",
      searchParams.get("assignedToId"),
    );
    this.assignScalarFilter(filters, "search", searchParams.get("search"));
    this.assignUnassignedFilter(filters, searchParams.get("unassignedOnly"));
    this.assignWorkOrderTypeFilter(filters, searchParams.get("woType"));

    return filters;
  }

  /** Approve atau reject request work order beserta notifikasi peminta. */
  async processRequestApproval(input: WorkOrderApprovalInput) {
    const userContext = await this.getUserContext(
      input.actor,
      input.permissions,
    );

    if (!userContext) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const workOrderResult = await this.workOrderService.getWorkOrderById(
      input.workOrderId,
      userContext,
    );

    if (!workOrderResult.success || !workOrderResult.data) {
      return {
        success: false as const,
        code: workOrderResult.code || "NOT_FOUND",
        error: workOrderResult.error,
      };
    }

    const actionResult = await this.executeRequestApprovalAction({
      action: input.action,
      workOrderId: input.workOrderId,
      userContext,
      reason: input.reason,
    });

    if (!actionResult.success) {
      return actionResult;
    }

    await this.notifyRequesterOfApprovalResult({
      requesterId: workOrderResult.data.requestedById,
      action: input.action,
      title: workOrderResult.data.title,
      workOrderId: input.workOrderId,
      reason: input.reason,
    });

    return actionResult;
  }

  /** Tambahkan komentar WO dan kirim notifikasi side effect. */
  async addComment(input: {
    workOrderId: string;
    message: string;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getUserContext(
      input.actor,
      input.permissions,
    );

    if (!userContext) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const result = await this.workOrderService.addComment(
      input.workOrderId,
      input.message,
      userContext,
    );

    if (!result.success) {
      return result;
    }

    await logger.logActivity({
      action: "CREATE",
      subject: "Work Order Comment",
      details: {
        workOrderId: input.workOrderId,
        commentId: (result.data as { id: string }).id,
        message: input.message.substring(0, 100),
      },
      userId: input.actor.id,
    });

    await this.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `${input.actor.name || "Admin"}: ${input.message.substring(0, 100)}`,
      actorName: input.actor.name || "Admin",
      actorId: input.actor.id,
    });

    return result;
  }

  /** Tambahkan task WO dan jalankan side effect notifikasi. */
  async addTask(input: {
    workOrderId: string;
    title: string;
    description?: string;
    order?: number;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getUserContext(
      input.actor,
      input.permissions,
    );

    if (!userContext) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const result = await this.workOrderService.addTask(
      input.workOrderId,
      {
        title: input.title,
        description: input.description,
        order: input.order,
      },
      userContext,
    );

    if (!result.success) {
      return result;
    }

    const task = result.data as { id: string; title: string; order: number };
    await logger.logActivity({
      action: "CREATE",
      subject: "Work Order Task",
      details: {
        workOrderId: input.workOrderId,
        taskId: task.id,
        taskTitle: task.title,
        order: task.order,
      },
      userId: input.actor.id,
    });

    await this.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `Admin menambahkan tugas: "${input.title}"`,
      actorName: input.actor.name || "Admin",
      actorId: input.actor.id,
    });

    return result;
  }

  /** Tambahkan material dengan resolusi gudang default user bila perlu. */
  async addMaterial(input: {
    workOrderId: string;
    barangId: string;
    quantity: number;
    notes?: string;
    gudangId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getUserContext(
      input.actor,
      input.permissions,
    );

    if (!userContext) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const gudangId = await this.resolveGudangId(
      input.gudangId,
      userContext.siteId,
    );
    return this.workOrderService.addMaterial(
      input.workOrderId,
      input.barangId,
      input.quantity,
      userContext,
      input.notes,
      gudangId,
    );
  }

  /** Ambil detail material berdasarkan update timeline. */
  async getMaterialDetail(workOrderId: string, updateId: string) {
    return this.repository.findMaterialDetail(workOrderId, updateId);
  }

  /** Kirim reminder manual untuk work order aktif. */
  async sendReminder(input: {
    workOrderId: string;
    customMessage?: string;
    targetDepartmentId?: string;
  }) {
    const workOrder = await this.repository.findReminderWorkOrderById(
      input.workOrderId,
    );

    if (!workOrder) {
      return { success: false as const, code: "NOT_FOUND" };
    }

    if (
      !(WORK_ORDER_REMINDER_STATUSES as readonly string[]).includes(
        workOrder.status,
      )
    ) {
      return { success: false as const, code: "INVALID_STATUS" };
    }

    const sentCount = await sendWorkOrderReminder(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: input.targetDepartmentId || workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      input.customMessage,
    );

    return { success: true as const, data: { sentCount } };
  }

  /** Hapus permanen atau cancel work order dengan side effect terkait. */
  async deleteWorkOrder(input: {
    workOrderId: string;
    permanent?: boolean;
    reason?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getUserContext(
      input.actor,
      input.permissions,
    );

    if (!userContext) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    if (input.permanent) {
      await this.repository.resetCanvasingByWorkOrderId(input.workOrderId);
      return this.workOrderService.deleteWorkOrder(
        input.workOrderId,
        userContext,
      );
    }

    const result = await this.workOrderService.updateStatus(
      input.workOrderId,
      "CANCELLED",
      userContext,
      input.reason || CANCEL_REASON_DEFAULT,
    );

    if (!result.success) {
      return result;
    }

    logActivitySafe({
      action: "DELETE",
      subject: "Work Order",
      userId: input.actor.id,
      details: {
        id: input.workOrderId,
        reason: input.reason || CANCEL_REASON_DEFAULT,
        type: "CANCEL",
      },
    });

    await workOrderCacheService.invalidateAllCaches();
    return result;
  }

  /** Ambil statistik response stats untuk route admin. */
  async getResponseStats(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    if (access.emptyResponse) {
      return { success: true as const, data: [] };
    }

    const range = this.buildPeriodRange(input.period || "last_30_days");
    const stats = await this.repository.getAdminResponseStats(
      range.dateFrom,
      range.dateTo,
      access.departmentId,
    );

    return { success: true as const, data: stats };
  }

  /** Ambil recent work orders dengan access filter admin. */
  async getRecentWorkOrders(input: {
    limit?: number;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    if (access.emptyResponse) {
      return { success: true as const, data: [] };
    }

    return this.workOrderService.getRecentWorkOrders(
      input.limit || DEFAULT_RECENT_LIMIT,
      {
        ...(access.departmentId ? { departmentId: access.departmentId } : {}),
      },
    );
  }

  /** Ambil workload departemen dengan filtering akses admin. */
  async getDepartmentWorkload(input: {
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    if (access.emptyResponse) {
      return { success: true as const, data: [] };
    }

    const dynamicImport = await import("../repositories/WorkOrderRepository");
    const repository = new dynamicImport.WorkOrderRepository();
    const data = await repository.getDepartmentWorkload(access.departmentId);
    return { success: true as const, data };
  }

  /** Ambil statistik overview dengan filtering akses admin. */
  async getStats(input: {
    filters: { departmentId?: string; assignedToId?: string };
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const filters = { ...input.filters };

    if (access.emptyResponse) {
      return { success: true as const, data: this.getEmptyStats() };
    }

    if (access.departmentId) {
      filters.departmentId = access.departmentId;
    }

    if (access.siteId) {
      Object.assign(filters, { siteId: access.siteId });
    }

    return this.workOrderService.getStatistics(filters);
  }

  /** Ambil summary top performer sesuai periode. */
  async getTopPerformers(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    if (access.emptyResponse) {
      return {
        success: true as const,
        data: { performers: [], topAssists: [] },
      };
    }

    const range = this.buildPeriodRange(input.period || "all_time");
    const data = await this.repository.getTopPerformanceSummary({
      limit: DEFAULT_TOP_LIMIT,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      departmentId: access.departmentId,
    });

    return { success: true as const, data };
  }

  /** Ambil data analytics trend dengan access filter admin. */
  async getTrends(input: {
    startDate: Date;
    endDate: Date;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    const access = await this.buildAccessFilters(input.user, input.permissions);

    if (access.unauthorized) {
      return { success: false as const, code: "UNAUTHORIZED" };
    }

    const dynamicImport = await import("../repositories/WorkOrderRepository");
    const repository = new dynamicImport.WorkOrderRepository();
    const departmentId = access.emptyResponse ? undefined : access.departmentId;
    const siteId = access.emptyResponse ? undefined : access.siteId;
    const [volumeTrend, issueTrend, performanceTrend, typeTrend] =
      await Promise.all([
        repository.getVolumeTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getIssueTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getPerformanceTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
        repository.getTypeTrend(
          input.startDate,
          input.endDate,
          departmentId,
          siteId,
        ),
      ]);

    return {
      success: true as const,
      data: {
        volumeTrend,
        issueTrend,
        performanceTrend,
        typeTrend,
        dateRange: {
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
        },
      },
    };
  }

  private assignListFilterValue(
    filters: WorkOrderListRouteFilters,
    key: string,
    value: string | null,
  ) {
    if (!value) {
      return;
    }

    filters[key] = value.includes(",") ? value.split(",") : value;
  }

  private assignScalarFilter(
    filters: WorkOrderListRouteFilters,
    key: string,
    value: string | null,
  ) {
    if (!value) {
      return;
    }

    filters[key] = value;
  }

  private assignUnassignedFilter(
    filters: WorkOrderListRouteFilters,
    value: string | null,
  ) {
    if (value === "true") {
      filters.unassignedOnly = true;
    }
  }

  private assignWorkOrderTypeFilter(
    filters: WorkOrderListRouteFilters,
    value: string | null,
  ) {
    if (value === "customer") {
      filters.isInternal = false;
      return;
    }

    if (value === "internal") {
      filters.isInternal = true;
    }
  }

  private async executeRequestApprovalAction(input: {
    workOrderId: string;
    action: WorkOrderRequestAction;
    userContext: UserContext;
    reason?: string;
  }) {
    if (input.action === "APPROVE") {
      return this.workOrderService.approveRequest(
        input.workOrderId,
        input.userContext,
      );
    }

    return this.workOrderService.rejectRequest(
      input.workOrderId,
      input.userContext,
      input.reason || "",
    );
  }

  /** Mengirim notifikasi hasil approve/reject kepada peminta work order. */
  private async notifyRequesterOfApprovalResult(input: {
    requesterId?: string | null;
    action: WorkOrderRequestAction;
    title: string;
    workOrderId: string;
    reason?: string;
  }) {
    if (!input.requesterId) {
      return;
    }

    const notificationTitle =
      input.action === "APPROVE"
        ? "✅ WO Request Disetujui"
        : "❌ WO Request Ditolak";
    const notificationMessage =
      input.action === "APPROVE"
        ? `Request Anda "${input.title}" telah disetujui and siap dikerjakan.`
        : `Request Anda "${input.title}" ditolak: ${input.reason}`;

    try {
      await createNotification({
        type: "WORK_ORDER",
        priority: input.action === "REJECT" ? "HIGH" : "NORMAL",
        title: notificationTitle,
        message: notificationMessage,
        link: `/admin/workorders/${input.workOrderId}`,
        userId: input.requesterId,
        sourceType: "WORK_ORDER",
        sourceId: input.workOrderId,
      });

      await sendPushToUsers(
        [input.requesterId],
        notificationTitle,
        notificationMessage,
        {
          workOrderId: input.workOrderId,
          type: "WO_REQUEST_RESULT",
          action: input.action,
          screen: "WorkOrderDetail",
        },
      );
    } catch {
      return;
    }
  }

  private async resolveGudangId(
    gudangId: string | undefined,
    siteId: string | undefined,
  ) {
    if (gudangId || !siteId) {
      return gudangId;
    }

    return this.repository.findFirstGudangBySite(siteId);
  }

  private async notifyWorkOrderUpdate(input: {
    workOrderId: string;
    message: string;
    actorName: string;
    actorId: string;
  }) {
    const workOrder = await this.repository.findWorkOrderNotificationPayload(
      input.workOrderId,
    );

    if (!workOrder?.assignedTo?.isActive) {
      return;
    }

    const isOnLeave = await this.repository.isUserOnApprovedLeave(
      workOrder.assignedTo.id,
    );
    await createNotification({
      type: "WORK_ORDER",
      priority: "NORMAL",
      title: `Update Work Order: ${workOrder.workOrderNumber}`,
      message: input.message,
      link: `/admin/workorders/${input.workOrderId}`,
      userId: workOrder.assignedTo.id,
      sourceType: "WORK_ORDER",
      sourceId: input.workOrderId,
      skipExpoPush: isOnLeave,
    });

    await onWorkOrderUpdated(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      input.message,
      input.actorName,
      input.actorId,
      [workOrder.assignedTo.id],
    );
  }

  private buildPeriodRange(period: string): Required<DateRange> {
    const now = new Date();

    if (period === "daily") {
      return {
        dateFrom: new Date(toStartOfDay(now)),
        dateTo: new Date(toEndOfDay(now)),
      };
    }

    if (period === "weekly") {
      const firstDay = new Date(now);
      firstDay.setDate(now.getDate() - now.getDay());
      return { dateFrom: new Date(toStartOfDay(firstDay)), dateTo: new Date() };
    }

    if (period === "monthly") {
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth(), 1),
        dateTo: new Date(),
      };
    }

    if (period === "yearly") {
      return {
        dateFrom: new Date(now.getFullYear(), 0, 1),
        dateTo: new Date(),
      };
    }

    if (period === "all_time") {
      return { dateFrom: new Date(0), dateTo: new Date() };
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - LAST_30_DAYS);
    return { dateFrom, dateTo: new Date() };
  }

  private getEmptyStats() {
    return {
      total: 0,
      pending: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
      verified: 0,
      closed: 0,
      cancelled: 0,
      urgentOpen: 0,
      avgCompletionTimeHours: 0,
      totalCost: 0,
      avgRating: null as number | null,
      totalWithRating: 0,
    };
  }
}

export const adminWorkOrderRouteService = new AdminWorkOrderRouteService();
