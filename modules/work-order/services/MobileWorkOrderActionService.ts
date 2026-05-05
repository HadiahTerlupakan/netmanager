import { socketEmitter } from "@/lib/websocket/emitter";
import { prisma } from "@/modules/database";

import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { processMitraCommission } from "./mobile-work-order-mitra-commission.helpers";
import {
  notifyMobileTaskUpdate,
  notifyMobileWorkOrderAction,
} from "./mobile-work-order-notification.helpers";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";
import {
  buildActionContext,
  ensureNotePayload,
  ensureWorkOrderStatus,
  getDefaultNoteMessage,
  storeCompletionAttachments,
  storeSingleAttachment,
} from "./work-order-mobile-action.helpers";
import {
  addOptionalNote,
  addPauseNote,
  ensureMobileWorkOrderAccess,
  getAllowedActionStatuses,
  getWorkOrderOrThrow,
} from "./work-order-mobile-action.support";
import type {
  HandleMobileActionInput,
  HandleTaskUpdateInput,
  MobileUserContext,
  WorkOrderActionExecutionInput,
  WorkOrderUpdateType,
} from "./work-order-mobile-action.types";

const UNKNOWN_USER_NAME = "Unknown";
const MOBILE_ALLOWED_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
];
const CLAIM_ALLOWED_WORK_ORDER_STATUS = "PENDING";
const START_ALLOWED_WORK_ORDER_STATUSES = ["ASSIGNED", "ON_HOLD"];
const COMPLETE_ALLOWED_WORK_ORDER_STATUS = "IN_PROGRESS";
const PAUSE_ALLOWED_WORK_ORDER_STATUS = "IN_PROGRESS";

/** Menangani aksi work order dari aplikasi mobile. */
export class MobileWorkOrderActionService {
  private readonly repository: WorkOrderRepository;

  constructor(repository?: WorkOrderRepository) {
    this.repository = repository ?? new WorkOrderRepository(prisma);
  }

  /** Perbarui status task work order dari mobile route. */
  async updateTaskStatus(input: HandleTaskUpdateInput) {
    await this.ensureMobileAccess(
      input.workOrderId,
      input.actor,
      MOBILE_ALLOWED_WORK_ORDER_STATUSES,
    );

    const task = await prisma.workOrderTasks.findFirst({
      where: {
        id: input.taskId,
        tenantId: input.tenantId,
        workOrderId: input.workOrderId,
      },
      select: { title: true },
    });
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    await this.repository.updateTask(input.taskId, {
      status: input.isCompleted ? "COMPLETED" : "PENDING",
      completedById: input.isCompleted ? input.actor.id : undefined,
    });

    const updatedWorkOrder = await getWorkOrderOrThrow(
      this.repository,
      input.workOrderId,
    );
    socketEmitter.updateWorkOrder(updatedWorkOrder);
    await notifyMobileTaskUpdate({
      updatedWorkOrder,
      taskTitle: task.title,
      taskInput: input,
    });
    return { success: true };
  }

  /** Eksekusi aksi work order mobile. */
  async handleAction(input: HandleMobileActionInput) {
    const actorProfile = await prisma.user.findFirst({
      where: { id: input.actor.id, tenantId: input.tenantId },
      select: { name: true },
    });
    const userIdForDb = actorProfile ? input.actor.id : undefined;
    const workOrder = await getWorkOrderOrThrow(
      this.repository,
      input.workOrderId,
    );
    await this.ensureActionAccess(input, workOrder.status);

    const actionContext = buildActionContext({
      actorName: actorProfile?.name || input.actor.name || UNKNOWN_USER_NAME,
      payload: input.payload,
      ticketNumber:
        workOrder.ticket?.ticketNumber ||
        workOrder.workOrderNumber ||
        input.workOrderId,
      workOrderId: input.workOrderId,
    });

    const actionInput: WorkOrderActionExecutionInput = {
      input,
      workOrder,
      actionContext,
      userIdForDb,
    };

    await this.runAction(actionInput);
    await notifyMobileWorkOrderAction({
      workOrder,
      actionInput: input,
      actorName: actionContext.actorName,
    });
    return {
      success: true,
      message: `Work Order ${input.payload.action} success`,
    };
  }

  private async runAction(input: WorkOrderActionExecutionInput) {
    switch (input.input.payload.action) {
      case "START":
        return this.startWorkOrder(input);
      case "CLAIM":
        return this.claimWorkOrder(input);
      case "COMPLETE":
        return this.completeWorkOrder(input);
      case "PAUSE":
        return this.pauseWorkOrder(input);
      case "COMMENT":
      case "NOTE":
        return this.addWorkOrderNote(input);
      default:
        throw new Error("INVALID_ACTION");
    }
  }

  private async startWorkOrder(input: WorkOrderActionExecutionInput) {
    ensureWorkOrderStatus(
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
    await addOptionalNote({
      repository: this.repository,
      workOrderId: input.input.workOrderId,
      notes: input.input.payload.notes,
      userIdForDb: input.userIdForDb,
    });
  }

  private async claimWorkOrder(input: WorkOrderActionExecutionInput) {
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

  private async completeWorkOrder(input: WorkOrderActionExecutionInput) {
    ensureWorkOrderStatus(
      input.workOrder?.status,
      [COMPLETE_ALLOWED_WORK_ORDER_STATUS],
      "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan",
    );
    await storeCompletionAttachments({
      actionInput: input,
      repository: this.repository,
    });
    await this.repository.complete(
      input.input.workOrderId,
      input.input.payload.notes,
      input.userIdForDb,
      input.actionContext.timestamp,
    );
    await syncWoStatusToTicket(input.input.workOrderId, "COMPLETED");
    await processMitraCommission(input);
  }

  private async pauseWorkOrder(input: WorkOrderActionExecutionInput) {
    ensureWorkOrderStatus(
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
    await addPauseNote({
      repository: this.repository,
      workOrderId: input.input.workOrderId,
      notes: input.input.payload.notes,
      userIdForDb: input.userIdForDb,
    });
  }

  private async addWorkOrderNote(input: WorkOrderActionExecutionInput) {
    ensureNotePayload(input.input.payload);
    await storeSingleAttachment({
      actionInput: input,
      repository: this.repository,
    });
    await this.repository.addUpdate({
      workOrderId: input.input.workOrderId,
      updateType: input.input.payload.action as WorkOrderUpdateType,
      message:
        input.input.payload.notes || getDefaultNoteMessage(input.input.payload),
      createdById: input.userIdForDb,
    });
  }

  private async ensureActionAccess(
    input: HandleMobileActionInput,
    workOrderStatus?: string,
  ) {
    const accessRule = getAllowedActionStatuses(input.payload.action);

    await ensureMobileWorkOrderAccess({
      repository: this.repository,
      workOrderId: input.workOrderId,
      actor: input.actor,
      allowedStatuses: accessRule.statuses,
      invalidStatusMessage: accessRule.invalidStatusMessage,
    });
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
    await ensureMobileWorkOrderAccess({
      repository: this.repository,
      workOrderId,
      actor,
      allowedStatuses,
      invalidStatusMessage,
    });
  }
}
