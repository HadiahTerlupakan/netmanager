import { format } from "date-fns";

import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import { prisma, prismaMitra } from "@/modules/database";

import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";
import { validateMobileAssignedWorkOrderAccess } from "./work-order-access";

const UNKNOWN_USER_NAME = "Unknown";
const MAX_COORDINATE_LENGTH = 8;
const DEFAULT_IMAGE_TYPE = "image/jpeg";
const DEFAULT_PENALTY_AMOUNT = 50000;
const MOBILE_ALLOWED_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
];
const MOBILE_COMPLETION_ALLOWED_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
];
const CLAIM_ALLOWED_WORK_ORDER_STATUS = "PENDING";
const START_ALLOWED_WORK_ORDER_STATUSES = ["ASSIGNED", "ON_HOLD"];
const COMPLETE_ALLOWED_WORK_ORDER_STATUS = "IN_PROGRESS";
const PAUSE_ALLOWED_WORK_ORDER_STATUS = "IN_PROGRESS";
const WORK_ORDER_UPLOAD_DIRECTORY = "public/uploads/workorders";
const WORK_ORDER_IMAGE_PURPOSE = "workorder-completion";

type MobileWorkOrderAction =
  | "START"
  | "CLAIM"
  | "COMPLETE"
  | "PAUSE"
  | "COMMENT"
  | "NOTE";
type WorkOrderUpdateType =
  | "COMMENT"
  | "NOTE"
  | "STATUS_CHANGE"
  | "PROGRESS_UPDATE"
  | "PHOTO";
type MitraWalletServiceContract = {
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

type MobileActionPayload = {
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

interface MobileUserContext {
  id: string;
  name?: string;
  role?: string;
  siteId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

interface HandleTaskUpdateInput {
  workOrderId: string;
  taskId: string;
  isCompleted: boolean;
  tenantId: string;
  actor: MobileUserContext;
}

interface HandleMobileActionInput {
  workOrderId: string;
  tenantId: string;
  actor: MobileUserContext;
  payload: MobileActionPayload;
}

/**
 * Mobile work order action service.
 */
export class MobileWorkOrderActionService {
  private readonly repository: WorkOrderRepository;

  constructor(repository?: WorkOrderRepository) {
    this.repository = repository ?? new WorkOrderRepository(prisma);
  }

  /**
   * Update task status from mobile route.
   */
  async updateTaskStatus(input: HandleTaskUpdateInput) {
    await this.ensureMobileAccess(
      input.workOrderId,
      input.actor,
      MOBILE_ALLOWED_WORK_ORDER_STATUSES,
    );

    const task = await this.findTaskSummary(
      input.taskId,
      input.workOrderId,
      input.tenantId,
    );
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    await this.repository.updateTask(input.taskId, {
      status: input.isCompleted ? "COMPLETED" : "PENDING",
      completedById: input.isCompleted ? input.actor.id : undefined,
    });

    const updatedWorkOrder = await this.repository.findById(input.workOrderId);
    if (!updatedWorkOrder) {
      throw new Error("WORK_ORDER_NOT_FOUND");
    }

    socketEmitter.updateWorkOrder(updatedWorkOrder);
    await this.notifyTaskUpdate(updatedWorkOrder, task.title, input);
    return { success: true };
  }

  /**
   * Handle mobile work order action update.
   */
  async handleAction(input: HandleMobileActionInput) {
    const actorProfile = await this.findActorProfile(
      input.actor.id,
      input.tenantId,
    );
    const userIdForDb = actorProfile ? input.actor.id : undefined;
    const workOrder = await this.getWorkOrderOrThrow(input.workOrderId);
    await this.ensureActionAccess(input, workOrder.status);

    const actionContext = this.buildActionContext({
      actorName: actorProfile?.name || input.actor.name || UNKNOWN_USER_NAME,
      payload: input.payload,
      ticketNumber:
        workOrder.ticket?.ticketNumber ||
        workOrder.workOrderNumber ||
        input.workOrderId,
      workOrderId: input.workOrderId,
    });

    await this.runAction({
      input,
      workOrder,
      actionContext,
      userIdForDb,
    });

    await this.notifyAdmins(workOrder, input, actionContext.actorName);
    return {
      success: true,
      message: `Work Order ${input.payload.action} success`,
    };
  }

  private async runAction(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    const action = input.input.payload.action;

    if (action === "START") {
      return this.startWorkOrder(input);
    }

    if (action === "CLAIM") {
      return this.claimWorkOrder(input);
    }

    if (action === "COMPLETE") {
      return this.completeWorkOrder(input);
    }

    if (action === "PAUSE") {
      return this.pauseWorkOrder(input);
    }

    if (action === "COMMENT" || action === "NOTE") {
      return this.addWorkOrderNote(input);
    }

    throw new Error("INVALID_ACTION");
  }

  private async startWorkOrder(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    this.ensureWorkOrderStatus(
      input.workOrder?.status,
      START_ALLOWED_WORK_ORDER_STATUSES,
      "Tidak dapat memulai WO dengan status",
    );
    await this.repository.start(
      input.input.workOrderId,
      input.userIdForDb,
      input.actionContext.timestamp,
    );
    await syncWoStatusToTicket(input.input.workOrderId, "IN_PROGRESS");
    await this.addOptionalNote(
      input.input.workOrderId,
      input.input.payload.notes,
      input.userIdForDb,
    );
  }

  private async claimWorkOrder(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
  }) {
    if (input.workOrder?.status !== CLAIM_ALLOWED_WORK_ORDER_STATUS) {
      throw new Error("Hanya WO berstatus PENDING yang dapat diklaim");
    }

    await this.repository.assign(
      input.input.workOrderId,
      input.input.actor.id,
      "Lead",
      input.input.actor.id,
    );
  }

  private async completeWorkOrder(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    this.ensureWorkOrderStatus(
      input.workOrder?.status,
      [COMPLETE_ALLOWED_WORK_ORDER_STATUS],
      "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan",
    );
    await this.storeCompletionAttachments(input);
    await this.repository.complete(
      input.input.workOrderId,
      input.input.payload.notes,
      input.userIdForDb,
      input.actionContext.timestamp,
    );
    await syncWoStatusToTicket(input.input.workOrderId, "COMPLETED");
    await this.processMitraCommission(input);
  }

  private async pauseWorkOrder(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    this.ensureWorkOrderStatus(
      input.workOrder?.status,
      [PAUSE_ALLOWED_WORK_ORDER_STATUS],
      "Hanya WO berstatus IN_PROGRESS yang dapat ditunda",
    );
    await this.repository.updateStatus(
      input.input.workOrderId,
      "ON_HOLD",
      input.userIdForDb,
      input.actionContext.timestamp,
    );
    await syncWoStatusToTicket(input.input.workOrderId, "ON_HOLD");
    await this.addPauseNote(
      input.input.workOrderId,
      input.input.payload.notes,
      input.userIdForDb,
    );
  }

  private async addWorkOrderNote(input: {
    input: HandleMobileActionInput;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    this.ensureNotePayload(input.input.payload);
    await this.storeSingleAttachment(input);
    await this.repository.addUpdate({
      workOrderId: input.input.workOrderId,
      updateType: input.input.payload.action as WorkOrderUpdateType,
      message:
        input.input.payload.notes ||
        this.getDefaultNoteMessage(input.input.payload),
      createdById: input.userIdForDb,
    });
  }

  private async ensureActionAccess(
    input: HandleMobileActionInput,
    workOrderStatus?: string,
  ) {
    const allowedStatuses =
      input.payload.action === "CLAIM"
        ? [CLAIM_ALLOWED_WORK_ORDER_STATUS]
        : MOBILE_COMPLETION_ALLOWED_WORK_ORDER_STATUSES;

    const invalidStatusMessage =
      input.payload.action === "CLAIM"
        ? "Hanya WO berstatus PENDING yang dapat diklaim"
        : "Work order tidak dapat diubah pada status ini";

    await this.ensureMobileAccess(
      input.workOrderId,
      input.actor,
      allowedStatuses,
      invalidStatusMessage,
    );
    if (!workOrderStatus) {
      throw new Error("WORK_ORDER_NOT_FOUND");
    }
  }

  private async ensureMobileAccess(
    workOrderId: string,
    actor: MobileUserContext,
    allowedStatuses: string[],
    invalidStatusMessage = "Work order harus dalam status ASSIGNED, IN_PROGRESS, atau ON_HOLD",
  ) {
    await validateMobileAssignedWorkOrderAccess({
      repository: this.repository,
      workOrderId,
      userContext: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        permissions: [],
        siteId: actor.siteId,
        tenantId: actor.tenantId,
        isSuperAdmin: Boolean(actor.isSuperAdmin),
      },
      allowedStatuses,
      invalidStatusMessage,
    });
  }

  private async getWorkOrderOrThrow(workOrderId: string) {
    const workOrder = await this.repository.findById(workOrderId);
    if (!workOrder) {
      throw new Error("WORK_ORDER_NOT_FOUND");
    }

    return workOrder;
  }

  private async findActorProfile(userId: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { name: true },
    });
  }

  private async findTaskSummary(
    taskId: string,
    workOrderId: string,
    tenantId: string,
  ) {
    return prisma.workOrderTasks.findFirst({
      where: { id: taskId, tenantId, workOrderId },
      select: { title: true },
    });
  }

  private buildActionContext(input: {
    actorName: string;
    payload: MobileActionPayload;
    ticketNumber: string;
    workOrderId: string;
  }) {
    return {
      actorName: input.actorName,
      timestamp: input.payload.timestamp
        ? new Date(input.payload.timestamp)
        : undefined,
      locationLabel: this.buildLocationLabel(input.payload),
      ticketNumber: input.ticketNumber,
      workOrderId: input.workOrderId,
    };
  }

  private buildLocationLabel(payload: MobileActionPayload) {
    const coords = this.buildCoordinateLabel(
      payload.latitude,
      payload.longitude,
    );
    if (payload.locationName && coords) {
      return `${payload.locationName} ${coords}`;
    }

    if (payload.locationName) {
      return payload.locationName;
    }

    return coords ? `Loc: ${coords}` : "Loc: Unknown";
  }

  private buildCoordinateLabel(
    latitude?: string | number,
    longitude?: string | number,
  ) {
    if (!latitude || !longitude) {
      return "";
    }

    const lat = String(latitude).slice(0, MAX_COORDINATE_LENGTH);
    const lng = String(longitude).slice(0, MAX_COORDINATE_LENGTH);
    return `(${lat}, ${lng})`;
  }

  private ensureWorkOrderStatus(
    status: string | undefined,
    allowed: string[],
    message: string,
  ) {
    if (status && allowed.includes(status)) {
      return;
    }

    if (message === "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan") {
      throw new Error(message);
    }

    throw new Error(`${message}: ${status}`);
  }

  private async addOptionalNote(
    workOrderId: string,
    notes?: string,
    userIdForDb?: string,
  ) {
    if (!notes) {
      return;
    }

    await this.repository.addUpdate({
      workOrderId,
      updateType: "NOTE",
      message: notes,
      createdById: userIdForDb,
    });
  }

  private async addPauseNote(
    workOrderId: string,
    notes?: string,
    userIdForDb?: string,
  ) {
    if (!notes) {
      return;
    }

    await this.repository.addUpdate({
      workOrderId,
      updateType: "NOTE",
      message: `Work Order Paused: ${notes}`,
      createdById: userIdForDb,
    });
  }

  private ensureNotePayload(payload: MobileActionPayload) {
    if (payload.notes || payload.photo || payload.photoUrl) {
      return;
    }

    throw new Error("Catatan atau foto wajib diisi");
  }

  private getDefaultNoteMessage(payload: MobileActionPayload) {
    return payload.photo || payload.photoUrl ? "Mengunggah foto" : "";
  }

  private async storeCompletionAttachments(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    const remoteUrls = input.input.payload.photoUrls || [];
    if (remoteUrls.length > 0) {
      await this.storeRemoteCompletionAttachments(
        input.input.workOrderId,
        remoteUrls,
        input.userIdForDb,
      );
      return;
    }

    const files = input.input.payload.photos || [];
    if (files.length === 0) {
      return;
    }

    await this.storeLocalCompletionAttachments(input, files);
  }

  private async storeRemoteCompletionAttachments(
    workOrderId: string,
    photoUrls: string[],
    userIdForDb?: string,
  ) {
    await Promise.all(
      photoUrls
        .filter(Boolean)
        .map((photoUrl, index) =>
          this.repository.addAttachment(
            workOrderId,
            `photo_${index}.jpg`,
            photoUrl,
            0,
            DEFAULT_IMAGE_TYPE,
            `[COMPLETION] Bukti Penyelesaian ${index + 1}`,
            userIdForDb,
          ),
        ),
    );
  }

  private async storeLocalCompletionAttachments(
    input: {
      input: HandleMobileActionInput;
      workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
      actionContext: ReturnType<
        MobileWorkOrderActionService["buildActionContext"]
      >;
      userIdForDb?: string;
    },
    files: File[],
  ) {
    for (const [index, file] of files.entries()) {
      const filePath = await this.saveWorkOrderImage({
        file,
        fileName: `${input.input.workOrderId}_complete_${Date.now()}_${index}`,
        workOrderId: input.input.workOrderId,
        watermarkLines: this.buildCompletionWatermark(
          input,
          index,
          files.length,
        ),
      });

      await this.repository.addAttachment(
        input.input.workOrderId,
        file.name,
        filePath,
        file.size,
        file.type,
        `[COMPLETION] Bukti Penyelesaian ${index + 1}`,
        input.userIdForDb,
      );
    }
  }

  private buildCompletionWatermark(
    input: {
      actionContext: ReturnType<
        MobileWorkOrderActionService["buildActionContext"]
      >;
    },
    index: number,
    totalFiles: number,
  ) {
    return [
      format(new Date(), "dd MMM yyyy HH:mm"),
      `#${input.actionContext.ticketNumber}`,
      `Tech: ${input.actionContext.actorName}`,
      input.actionContext.locationLabel,
      `[COMPLETED] ${index + 1}/${totalFiles}`,
    ];
  }

  private async saveWorkOrderImage(input: {
    file: File;
    fileName: string;
    workOrderId: string;
    watermarkLines: string[];
  }) {
    const dateFolder = format(new Date(), "yyyy-MM-dd");
    return convertAndSaveImage(
      input.file,
      `${WORK_ORDER_UPLOAD_DIRECTORY}/${dateFolder}`,
      input.fileName,
      WORK_ORDER_IMAGE_PURPOSE,
      input.workOrderId,
      input.watermarkLines,
    );
  }

  private async storeSingleAttachment(input: {
    input: HandleMobileActionInput;
    actionContext: ReturnType<
      MobileWorkOrderActionService["buildActionContext"]
    >;
    userIdForDb?: string;
  }) {
    if (input.input.payload.photoUrl) {
      await this.repository.addAttachment(
        input.input.workOrderId,
        `photo_${input.input.payload.action}.jpg`,
        input.input.payload.photoUrl,
        0,
        DEFAULT_IMAGE_TYPE,
        input.input.payload.notes || "Update Foto",
        input.userIdForDb,
      );
      return;
    }

    if (!(input.input.payload.photo instanceof File)) {
      return;
    }

    const filePath = await this.saveWorkOrderImage({
      file: input.input.payload.photo,
      fileName: `${input.input.workOrderId}_${input.input.payload.action.toLowerCase()}_${Date.now()}`,
      workOrderId: input.input.workOrderId,
      watermarkLines: [
        format(new Date(), "dd MMM yyyy HH:mm"),
        `#${input.actionContext.ticketNumber}`,
        `Tech: ${input.actionContext.actorName}`,
        input.actionContext.locationLabel,
      ],
    });

    await this.repository.addAttachment(
      input.input.workOrderId,
      input.input.payload.photo.name,
      filePath,
      input.input.payload.photo.size,
      input.input.payload.photo.type,
      input.input.payload.notes || "Update Foto",
      input.userIdForDb,
    );
  }

  private async processMitraCommission(input: {
    input: HandleMobileActionInput;
    workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
  }) {
    try {
      const mitra = await prismaMitra.mitra.findUnique({
        where: { id: input.input.actor.id },
        select: {
          mitraType: true,
          mitraRateWoPsb: true,
          mitraRateWoMaintenance: true,
        },
      });

      if (mitra?.mitraType !== "MITRA_TEKNISI") {
        return;
      }

      const { getMitraWalletService } = await import("@/modules/mitra");
      const walletService = getMitraWalletService();
      await this.applyWarrantyCommission(input, mitra, walletService);
    } catch (error) {
      logger.error("[MitraCommission] Error:", error as Error);
    }
  }

  private async applyWarrantyCommission(
    input: {
      input: HandleMobileActionInput;
      workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    },
    mitra: {
      mitraRateWoPsb: number | null;
      mitraRateWoMaintenance: number | null;
    },
    walletService: MitraWalletServiceContract,
  ) {
    const ticketNumber =
      input.workOrder?.ticket?.ticketNumber ||
      input.workOrder?.workOrderNumber ||
      input.input.workOrderId;
    const rate = this.resolveMitraRate(input.workOrder?.type, mitra);

    if (input.workOrder?.isWarranty && input.workOrder.warrantyOwnerId) {
      await this.handleWarrantyCommission(
        input,
        walletService,
        rate,
        ticketNumber,
      );
      return;
    }

    if (rate <= 0) {
      return;
    }

    await walletService.addEarning(
      input.input.actor.id,
      rate,
      `Komisi WO #${ticketNumber} (${input.workOrder?.type})`,
      input.input.workOrderId,
      "WORK_ORDER",
    );
  }

  private async handleWarrantyCommission(
    input: {
      input: HandleMobileActionInput;
      workOrder: Awaited<ReturnType<WorkOrderRepository["findById"]>>;
    },
    walletService: MitraWalletServiceContract,
    rate: number,
    ticketNumber: string,
  ) {
    if (input.workOrder?.warrantyOwnerId === input.input.actor.id) {
      await walletService.addEarning(
        input.input.actor.id,
        0,
        `Pengerjaan Garansi Mandiri #${ticketNumber}`,
        input.input.workOrderId,
        "WORK_ORDER",
      );
      return;
    }

    if (rate > 0) {
      await walletService.addEarning(
        input.input.actor.id,
        rate,
        `Komisi WO #${ticketNumber} (${input.workOrder?.type}) - Lelang Garansi`,
        input.input.workOrderId,
        "WORK_ORDER",
      );
    }

    const originalOwner = await prismaMitra.mitra.findUnique({
      where: { id: input.workOrder?.warrantyOwnerId || "" },
      select: { penaltyPsb: true },
    });

    await walletService.deductBalance(
      input.workOrder?.warrantyOwnerId || "",
      originalOwner?.penaltyPsb || DEFAULT_PENALTY_AMOUNT,
      `Denda Garansi SLA #${ticketNumber}`,
      input.input.workOrderId,
      "WORK_ORDER",
    );
  }

  private resolveMitraRate(
    workOrderType: string | undefined,
    mitra: {
      mitraRateWoPsb: number | null;
      mitraRateWoMaintenance: number | null;
    },
  ) {
    return workOrderType === "INSTALLATION"
      ? mitra.mitraRateWoPsb || 0
      : mitra.mitraRateWoMaintenance || 0;
  }

  private async notifyTaskUpdate(
    updatedWorkOrder: NonNullable<
      Awaited<ReturnType<WorkOrderRepository["findById"]>>
    >,
    taskTitle: string | null,
    input: HandleTaskUpdateInput,
  ) {
    await notifyAdminsAboutMobileAction({
      workOrderId: input.workOrderId,
      workOrderNumber: updatedWorkOrder.workOrderNumber,
      title: updatedWorkOrder.title,
      actionType: "NOTE",
      actionMessage: input.isCompleted
        ? `Menyelesaikan task: ${taskTitle || UNKNOWN_USER_NAME}`
        : `Membatalkan task: ${taskTitle || UNKNOWN_USER_NAME}`,
      triggeredByUserId: input.actor.id,
      triggeredByName: input.actor.name || UNKNOWN_USER_NAME,
      ...(updatedWorkOrder.departmentId && {
        departmentId: updatedWorkOrder.departmentId,
      }),
      ...(updatedWorkOrder.siteId && { siteId: updatedWorkOrder.siteId }),
    }).catch((error) => logger.error("[TaskNotify] Error:", error));
  }

  private async notifyAdmins(
    workOrder: NonNullable<
      Awaited<ReturnType<WorkOrderRepository["findById"]>>
    >,
    input: HandleMobileActionInput,
    actorName: string,
  ) {
    await notifyAdminsAboutMobileAction({
      workOrderId: input.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      actionType: input.payload.action,
      actionMessage: `${input.payload.action} Work Order: ${input.payload.notes || ""}`,
      triggeredByUserId: input.actor.id,
      triggeredByName: actorName,
      ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
      ...(workOrder.siteId && { siteId: workOrder.siteId }),
    });
  }
}
