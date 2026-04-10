import {
  firebaseRealtimeService,
  LEGACY_TO_REALTIME_EVENT,
} from "@/lib/realtime";
import {
  type CountPayload,
  type NotificationPayload,
  type TicketPayload,
  type WorkOrderPayload,
} from "./types";

type LegacyRealtimeEvent = keyof typeof LEGACY_TO_REALTIME_EVENT;

type RealtimeScopeInput = {
  kind: "user" | "department" | "admin" | "workorder" | "ticket";
  id: string;
};

function publishLegacyEvent(
  event: LegacyRealtimeEvent,
  scope: RealtimeScopeInput,
  payload: unknown,
) {
  return firebaseRealtimeService.publish({
    type: LEGACY_TO_REALTIME_EVENT[event],
    scope,
    payload,
  });
}

function adminScope(stream: string, siteId?: string): RealtimeScopeInput {
  return {
    kind: "admin",
    id: siteId ? `${stream}.site.${siteId}` : stream,
  };
}

function dispatchRealtime(
  event: LegacyRealtimeEvent,
  scope: RealtimeScopeInput,
  payload: unknown,
) {
  void publishLegacyEvent(event, scope, payload).catch((error) => {
    console.error(
      `[Realtime] Failed to publish ${event} to ${scope.kind}:${scope.id}`,
      error,
    );
  });
}

export const socketEmitter = {
  notifyUser(userId: string, notification: NotificationPayload) {
    dispatchRealtime(
      "notification:new",
      { kind: "user", id: userId },
      notification,
    );
  },

  notifyDepartment(departmentId: string, notification: NotificationPayload) {
    dispatchRealtime(
      "notification:new",
      { kind: "department", id: departmentId },
      notification,
    );
  },

  notifyAdmins(notification: NotificationPayload, siteId?: string) {
    dispatchRealtime(
      "notification:new",
      adminScope("notifications", siteId),
      notification,
    );
  },

  updateNotificationCount(userId: string, count: number) {
    const payload: CountPayload = { count };

    dispatchRealtime(
      "notification:count",
      { kind: "user", id: userId },
      payload,
    );
  },

  newTicket(ticket: TicketPayload, siteId?: string) {
    dispatchRealtime("ticket:new", adminScope("tickets", siteId), ticket);
  },

  updateTicket(ticket: TicketPayload, siteId?: string) {
    dispatchRealtime("ticket:update", adminScope("tickets", siteId), ticket);
  },

  ticketReply(ticket: TicketPayload, siteId?: string, targetUserId?: string) {
    dispatchRealtime("ticket:reply", adminScope("tickets", siteId), ticket);

    if (targetUserId) {
      dispatchRealtime(
        "ticket:reply",
        { kind: "user", id: targetUserId },
        ticket,
      );
    }
  },

  ticketMessage(
    ticketId: string,
    reply: {
      id: string;
      message: string;
      isFromAdmin: boolean;
      createdAt: string;
      sender?: { id: string; name: string; image?: string } | null;
      attachments?: string[] | null;
    },
  ) {
    dispatchRealtime(
      "ticket:message",
      { kind: "ticket", id: ticketId },
      {
        ticketId,
        reply,
      },
    );
  },

  updateTicketCount(count: number, siteId?: string) {
    const payload: CountPayload = { count };

    dispatchRealtime("ticket:count", adminScope("tickets", siteId), payload);
  },

  newWorkOrder(
    workOrder: WorkOrderPayload,
    departmentId?: string,
    siteId?: string,
  ) {
    dispatchRealtime(
      "workorder:new",
      adminScope("workorders", siteId),
      workOrder,
    );

    if (departmentId) {
      dispatchRealtime(
        "workorder:new",
        { kind: "department", id: departmentId },
        workOrder,
      );
    }
  },

  updateWorkOrder(workOrder: WorkOrderPayload, siteId?: string) {
    dispatchRealtime(
      "workorder:update",
      adminScope("workorders", siteId),
      workOrder,
    );

    if (workOrder.assignedToId) {
      dispatchRealtime(
        "workorder:update",
        { kind: "user", id: workOrder.assignedToId },
        workOrder,
      );
    }

    if (workOrder.id) {
      dispatchRealtime(
        "workorder:update",
        { kind: "workorder", id: workOrder.id },
        workOrder,
      );
    }
  },

  workOrderAssigned(workOrder: WorkOrderPayload, assignedToId: string) {
    dispatchRealtime(
      "workorder:assigned",
      { kind: "user", id: assignedToId },
      workOrder,
    );
  },

  workOrderActivity(
    workOrderId: string,
    activity: {
      id: string;
      type: "comment" | "update" | "attachment";
      message?: string;
      updateType?: string;
      createdAt: string;
      createdBy?: {
        id: string;
        firstName?: string;
        lastName?: string;
        name?: string;
      } | null;
      attachment?: {
        id: string;
        fileName: string;
        filePath: string;
        fileType: string;
        caption?: string | null;
      } | null;
    },
  ) {
    dispatchRealtime(
      "workorder:activity",
      { kind: "workorder", id: workOrderId },
      {
        workOrderId,
        activity,
      },
    );
  },

  inventoryUpdate(data: {
    type: "masuk" | "keluar";
    userId: string;
    barangId?: string;
    gudangId?: string;
    jumlah?: number;
    totalStok?: number;
    siteId?: string;
  }) {
    dispatchRealtime(
      "inventory:update",
      adminScope("inventory", data.siteId),
      data,
    );
    dispatchRealtime(
      "inventory:update",
      { kind: "user", id: data.userId },
      data,
    );
  },

  chatMessage(
    userId: string,
    payload: {
      id: string;
      content: string | null;
      imageUrl?: string | null;
      conversationId: string;
      senderId: string;
      senderName: string;
      createdAt: string;
      isOwn: boolean;
      isBroadcast?: boolean;
    },
  ) {
    dispatchRealtime("chat:message", { kind: "user", id: userId }, payload);
  },

  broadcast(_event: string, _data: unknown) {},

  forceLogout(userId: string) {
    dispatchRealtime(
      "session:forceLogout",
      { kind: "user", id: userId },
      {
        message: "Sesi Anda telah diakhiri oleh administrator",
        timestamp: new Date().toISOString(),
      },
    );
  },

  profileRefresh(userId: string) {
    dispatchRealtime(
      "profile:refresh",
      { kind: "user", id: userId },
      {
        timestamp: new Date().toISOString(),
      },
    );
  },
};
