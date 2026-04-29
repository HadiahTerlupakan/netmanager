import { logger } from "@/lib/logger";
import { onWorkOrderCreated } from "@/modules/work-order";

export class MixRadiusDismantleNotificationService {
  /** Publish dismantle work order notifications. */
  async dispatchWorkOrderCreated(
    workOrder: {
      id: string;
      workOrderNumber: string;
      title: string;
      type: string;
      priority: string;
      departmentId: string | null;
      siteId: string | null;
      status: string;
      createdAt: Date;
    },
    userId: string,
  ) {
    await onWorkOrderCreated(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
      },
      userId,
    ).catch((error) => {
      logger.error("[Dismantle] Notification error:", error);
    });

    await this.broadcastWorkOrder(workOrder);
  }

  private async broadcastWorkOrder(workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId: string | null;
    status: string;
    createdAt: Date;
  }) {
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.newWorkOrder(
        {
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          type: workOrder.type,
          status: workOrder.status,
          priority: workOrder.priority,
          createdAt: workOrder.createdAt.toISOString(),
          ...(workOrder.departmentId
            ? { departmentId: workOrder.departmentId }
            : {}),
        },
        workOrder.departmentId || undefined,
      );
    } catch (error) {
      logger.error("[Dismantle] Socket broadcast failed", error);
    }
  }
}
