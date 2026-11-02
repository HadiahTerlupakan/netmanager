import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import { AdminWorkOrderNotificationRouteService } from "./AdminWorkOrderNotificationRouteService";
import { workOrderCacheService } from "./WorkOrderCacheService";
import { sendWorkOrderReminder } from "./WorkOrderNotifications";
import { getWorkOrderService } from "./WorkOrderService";
import {
  recordWorkOrderActivity,
  WORK_ORDER_ACTIVITY_ACTIONS,
} from "./work-order-activity-log";
import type { UserContext } from "./WorkOrderService";
import {
  canSendWorkOrderReminder,
  executeRequestApprovalAction,
  logCommentCreated,
  logTaskCreated,
  type WorkOrderRequestAction,
} from "./admin-work-order-action.helpers";

const CANCEL_REASON_DEFAULT = "Cancelled by admin";

const MATERIAL_GUDANG_MESSAGES = {
  WORK_ORDER_NO_SITE:
    "Work order ini belum punya site, jadi gudang asal material tidak bisa ditentukan otomatis. Pilih gudangnya secara eksplisit.",
  GUDANG_OTHER_SITE:
    "Gudang yang dipilih tidak ditemukan atau tidak berada di site work order ini. Pilih gudang dari site work order.",
  SITE_NO_GUDANG:
    "Site work order ini belum punya gudang. Tautkan gudang ke site tersebut sebelum menambahkan material.",
} as const;

/**
 * Bentuk ulang kegagalan sebagai objek baru ber-`success: false` literal.
 * Proyek ini memakai `strictNullChecks: false`, sehingga mengembalikan variabel
 * union yang sudah "dipersempit" tetap membocorkan cabang sukses ke tipe hasil.
 */
function toFailureResult(failure: { code?: string; error?: string }) {
  return {
    success: false as const,
    code: failure.code ?? "NOT_FOUND",
    error: failure.error,
  };
}

function materialGudangError(error: string) {
  return { success: false as const, code: "ADD_MATERIAL_ERROR", error };
}

type PermissionList = string[] | undefined;

interface WorkOrderApprovalInput {
  workOrderId: string;
  action: WorkOrderRequestAction;
  actor: { id: string; role?: string; name?: string | null };
  permissions?: PermissionList;
  reason?: string;
}

export class AdminWorkOrderActionRouteService {
  private readonly notificationService: AdminWorkOrderNotificationRouteService;

  constructor(
    private readonly repository: AdminWorkOrderRouteRepository,
    private readonly getUserContext: (
      user: { id: string; role?: string; name?: string | null },
      permissions?: PermissionList,
    ) => Promise<UserContext | null>,
  ) {
    this.notificationService = new AdminWorkOrderNotificationRouteService(
      repository,
    );
  }

  private get workOrderService() {
    return getWorkOrderService();
  }

  /** Approve atau reject request work order beserta notifikasi peminta. */
  async processRequestApproval(input: WorkOrderApprovalInput) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

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

    const actionResult = await executeRequestApprovalAction({
      workOrderService: this.workOrderService,
      action: input.action,
      workOrderId: input.workOrderId,
      userContext,
      reason: input.reason,
    });
    if (!actionResult.success) return actionResult;

    await this.notificationService.notifyRequesterOfApprovalResult({
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
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    const result = await this.workOrderService.addComment(
      input.workOrderId,
      input.message,
      userContext,
    );
    if (!result.success) return result;

    await logCommentCreated({
      workOrderId: input.workOrderId,
      message: input.message,
      actorId: input.actor.id,
      truncateMessage: this.notificationService.truncateActivityMessage.bind(
        this.notificationService,
      ),
    });
    await this.notificationService.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `${input.actor.name || "Admin"}: ${this.notificationService.truncateActivityMessage(input.message)}`,
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
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    const result = await this.workOrderService.addTask(
      input.workOrderId,
      {
        title: input.title,
        description: input.description,
        order: input.order,
      },
      userContext,
    );
    if (!result.success) return result;

    await logTaskCreated({
      workOrderId: input.workOrderId,
      actorId: input.actor.id,
      task: result.data as { id: string; title: string; order: number },
    });
    await this.notificationService.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `Admin menambahkan tugas: "${input.title}"`,
      actorName: input.actor.name || "Admin",
      actorId: input.actor.id,
    });

    return result;
  }

  /**
   * Tambahkan material dari gudang yang berada di site work order.
   *
   * Gudang dari klien hanya diterima bila tertaut ke site work order; tanpa
   * gudang, dipakai gudang pertama site itu. Bila gudang tidak bisa ditentukan
   * (WO tanpa site, atau site tanpa gudang) permintaan ditolak dengan pesan
   * jelas — bukan diam-diam mengambil stok gudang site lain.
   */
  async addMaterial(input: {
    workOrderId: string;
    barangId: string;
    quantity: number;
    notes?: string;
    gudangId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    const access = await this.requireScopedWorkOrder(
      input.workOrderId,
      userContext,
    );
    if (!access.success) return toFailureResult(access);

    const gudang = await this.resolveMaterialGudang(
      input.gudangId,
      access.data.siteId ?? null,
    );
    if (!gudang.success) return toFailureResult(gudang);

    return this.workOrderService.addMaterial(
      input.workOrderId,
      input.barangId,
      input.quantity,
      userContext,
      input.notes,
      gudang.gudangId,
    );
  }

  /** Ambil detail material timeline setelah akses lingkup work order lolos. */
  async getMaterialDetail(input: {
    workOrderId: string;
    updateId: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    const access = await this.requireScopedWorkOrder(
      input.workOrderId,
      userContext,
    );
    if (!access.success) return toFailureResult(access);

    const detail = await this.repository.findMaterialDetail(
      input.workOrderId,
      input.updateId,
    );
    if (detail.code !== "OK") {
      return { success: false as const, code: detail.code };
    }
    return { success: true as const, data: detail.data };
  }

  /** Kirim reminder manual untuk work order aktif dan catat pengirimnya. */
  async sendReminder(input: {
    workOrderId: string;
    customMessage?: string;
    targetDepartmentId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    const access = await this.requireScopedWorkOrder(
      input.workOrderId,
      userContext,
    );
    if (!access.success) return toFailureResult(access);

    const workOrder = await this.repository.findReminderWorkOrderById(
      input.workOrderId,
    );
    if (!workOrder) return { success: false as const, code: "NOT_FOUND" };
    if (!canSendWorkOrderReminder(workOrder.status)) {
      return { success: false as const, code: "INVALID_STATUS" };
    }

    const departmentId = input.targetDepartmentId || workOrder.departmentId;
    const sentCount = await sendWorkOrderReminder(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      input.customMessage,
    );
    recordWorkOrderActivity({
      action: WORK_ORDER_ACTIVITY_ACTIONS.SEND_REMINDER,
      workOrder,
      actorId: input.actor.id,
      details: {
        departmentId,
        sentCount,
        ...(input.customMessage ? { message: input.customMessage } : {}),
      },
    });

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
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };

    if (input.permanent) {
      return this.deleteWorkOrderPermanently(input.workOrderId, userContext);
    }

    return this.cancelWorkOrder(input, userContext);
  }

  private getRequiredUserContext(
    user: { id: string; role?: string; name?: string | null },
    permissions?: PermissionList,
  ) {
    return this.getUserContext(user, permissions);
  }

  /**
   * Pastikan aktor boleh menyentuh work order ini sesuai toggle
   * `workorders:site_only|department_only`. Mengembalikan NOT_FOUND/FORBIDDEN
   * dari jalur baca pusat supaya pesan dan kode galatnya seragam.
   */
  private async requireScopedWorkOrder(
    workOrderId: string,
    userContext: UserContext,
  ) {
    const result = await this.workOrderService.getWorkOrderById(
      workOrderId,
      userContext,
    );
    if (!result.success || !result.data) {
      return {
        success: false as const,
        code: result.code || "NOT_FOUND",
        error: result.error,
      };
    }
    return { success: true as const, data: result.data };
  }

  private async resolveMaterialGudang(
    requestedGudangId: string | undefined,
    workOrderSiteId: string | null,
  ): Promise<{
    success: boolean;
    gudangId?: string;
    code?: string;
    error?: string;
  }> {
    // Work order tanpa site hanya bisa dibuka role yang tidak dibatasi site,
    // jadi gudang pilihan klien cukup dibuktikan ada di tenant ini.
    if (requestedGudangId) {
      const isAllowed = await this.repository.isGudangAvailableForSite(
        requestedGudangId,
        workOrderSiteId,
      );
      return isAllowed
        ? { success: true, gudangId: requestedGudangId }
        : materialGudangError(MATERIAL_GUDANG_MESSAGES.GUDANG_OTHER_SITE);
    }

    if (!workOrderSiteId) {
      return materialGudangError(MATERIAL_GUDANG_MESSAGES.WORK_ORDER_NO_SITE);
    }

    const siteGudangId =
      await this.repository.findFirstGudangBySite(workOrderSiteId);
    return siteGudangId
      ? { success: true, gudangId: siteGudangId }
      : materialGudangError(MATERIAL_GUDANG_MESSAGES.SITE_NO_GUDANG);
  }

  private async deleteWorkOrderPermanently(
    workOrderId: string,
    userContext: UserContext,
  ) {
    // Validasi lingkup lebih dulu: reset canvasing adalah efek samping yang
    // tidak boleh terjadi pada work order site/departemen lain.
    const access = await this.requireScopedWorkOrder(workOrderId, userContext);
    if (!access.success) return toFailureResult(access);

    await this.repository.resetCanvasingByWorkOrderId(workOrderId);
    return this.workOrderService.deleteWorkOrder(workOrderId, userContext);
  }

  private async cancelWorkOrder(
    input: {
      workOrderId: string;
      reason?: string;
    },
    userContext: UserContext,
  ) {
    const reason = input.reason || CANCEL_REASON_DEFAULT;
    const result = await this.workOrderService.updateStatus(
      input.workOrderId,
      "CANCELLED",
      userContext,
      reason,
    );
    if (!result.success) return result;

    await workOrderCacheService.invalidateAllCaches();

    return result;
  }
}
