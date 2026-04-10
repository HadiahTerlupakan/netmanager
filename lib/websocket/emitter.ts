import {
  firebaseRealtimeService,
  LEGACY_TO_REALTIME_EVENT,
} from "@/lib/realtime";

import { getSocketServer } from "./server";
import {
  SOCKET_EVENTS,
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
  emitLegacy?: () => void,
) {
  if (emitLegacy) {
    emitLegacy();
  }

  void publishLegacyEvent(event, scope, payload).catch((error) => {
    console.error(
      `[Realtime] Failed to publish ${event} to ${scope.kind}:${scope.id}`,
      error,
    );
  });
}

export const socketEmitter = {
  notifyUser(userId: string, notification: NotificationPayload) {
    const io = getSocketServer();
    dispatchRealtime(
      "notification:new",
      { kind: "user", id: userId },
      notification,
      io
        ? () => {
            io.to(`user:${userId}`).emit(
              SOCKET_EVENTS.NOTIFICATION_NEW,
              notification,
            );
          }
        : undefined,
    );
  },

  notifyDepartment(departmentId: string, notification: NotificationPayload) {
    const io = getSocketServer();
    dispatchRealtime(
      "notification:new",
      { kind: "department", id: departmentId },
      notification,
      io
        ? () => {
            io.to(`department:${departmentId}`).emit(
              SOCKET_EVENTS.NOTIFICATION_NEW,
              notification,
            );
          }
        : undefined,
    );
  },

  notifyAdmins(notification: NotificationPayload, siteId?: string) {
    const io = getSocketServer();
    const scope = adminScope("notifications", siteId);
    const room = siteId
      ? `admin:notifications:site:${siteId}`
      : "admin:notifications";

    dispatchRealtime(
      "notification:new",
      scope,
      notification,
      io
        ? () => {
            io.to(room).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification);
          }
        : undefined,
    );
  },

  updateNotificationCount(userId: string, count: number) {
    const io = getSocketServer();
    const payload: CountPayload = { count };

    dispatchRealtime(
      "notification:count",
      { kind: "user", id: userId },
      payload,
      io
        ? () => {
            io.to(`user:${userId}`).emit(
              SOCKET_EVENTS.NOTIFICATION_COUNT,
              payload,
            );
          }
        : undefined,
    );
  },

  newTicket(ticket: TicketPayload, siteId?: string) {
    const io = getSocketServer();
    const scope = adminScope("tickets", siteId);
    const room = siteId ? `admin:tickets:site:${siteId}` : "admin:tickets";

    dispatchRealtime(
      "ticket:new",
      scope,
      ticket,
      io
        ? () => {
            io.to(room).emit(SOCKET_EVENTS.TICKET_NEW, ticket);
          }
        : undefined,
    );
  },

  updateTicket(ticket: TicketPayload, siteId?: string) {
    const io = getSocketServer();
    const scope = adminScope("tickets", siteId);
    const room = siteId ? `admin:tickets:site:${siteId}` : "admin:tickets";

    dispatchRealtime(
      "ticket:update",
      scope,
      ticket,
      io
        ? () => {
            io.to(room).emit(SOCKET_EVENTS.TICKET_UPDATE, ticket);
          }
        : undefined,
    );
  },

  ticketReply(ticket: TicketPayload, siteId?: string, targetUserId?: string) {
    const io = getSocketServer();
    const scope = adminScope("tickets", siteId);
    const room = siteId ? `admin:tickets:site:${siteId}` : "admin:tickets";

    dispatchRealtime(
      "ticket:reply",
      scope,
      ticket,
      io
        ? () => {
            io.to(room).emit(SOCKET_EVENTS.TICKET_REPLY, ticket);
            if (targetUserId) {
              io.to(`user:${targetUserId}`).emit(
                SOCKET_EVENTS.TICKET_REPLY,
                ticket,
              );
            }
          }
        : undefined,
    );

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
    const io = getSocketServer();
    const payload = { ticketId, reply };

    dispatchRealtime(
      "ticket:message",
      { kind: "ticket", id: ticketId },
      payload,
      io
        ? () => {
            io.to(`ticket:${ticketId}`).emit(
              SOCKET_EVENTS.TICKET_MESSAGE,
              payload,
            );
          }
        : undefined,
    );
  },

  updateTicketCount(count: number, siteId?: string) {
    const io = getSocketServer();
    const payload: CountPayload = { count };
    const scope = adminScope("tickets", siteId);
    const room = siteId ? `admin:tickets:site:${siteId}` : "admin:tickets";

    dispatchRealtime(
      "ticket:count",
      scope,
      payload,
      io
        ? () => {
            io.to(room).emit(SOCKET_EVENTS.TICKET_COUNT, payload);
          }
        : undefined,
    );
  },

  newWorkOrder(
    workOrder: WorkOrderPayload,
    departmentId?: string,
    siteId?: string,
  ) {
    const io = getSocketServer();
    const adminRoom = siteId
      ? `admin:workorders:site:${siteId}`
      : "admin:workorders";

    dispatchRealtime(
      "workorder:new",
      adminScope("workorders", siteId),
      workOrder,
      io
        ? () => {
            io.to(adminRoom).emit(SOCKET_EVENTS.WORKORDER_NEW, workOrder);
            if (departmentId) {
              io.to(`department:${departmentId}`).emit(
                SOCKET_EVENTS.WORKORDER_NEW,
                workOrder,
              );
            }
          }
        : undefined,
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
    const io = getSocketServer();
    const adminRoom = siteId
      ? `admin:workorders:site:${siteId}`
      : "admin:workorders";

    dispatchRealtime(
      "workorder:update",
      adminScope("workorders", siteId),
      workOrder,
      io
        ? () => {
            io.to(adminRoom).emit(SOCKET_EVENTS.WORKORDER_UPDATE, workOrder);
            if (workOrder.assignedToId) {
              io.to(`user:${workOrder.assignedToId}`).emit(
                SOCKET_EVENTS.WORKORDER_UPDATE,
                workOrder,
              );
            }
            if (workOrder.id) {
              io.to(`workorder:${workOrder.id}`).emit(
                SOCKET_EVENTS.WORKORDER_UPDATE,
                workOrder,
              );
            }
          }
        : undefined,
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
    const io = getSocketServer();
    dispatchRealtime(
      "workorder:assigned",
      { kind: "user", id: assignedToId },
      workOrder,
      io
        ? () => {
            io.to(`user:${assignedToId}`).emit(
              SOCKET_EVENTS.WORKORDER_ASSIGNED,
              workOrder,
            );
          }
        : undefined,
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
    const io = getSocketServer();
    const payload = { workOrderId, activity };

    dispatchRealtime(
      "workorder:activity",
      { kind: "workorder", id: workOrderId },
      payload,
      io
        ? () => {
            io.to(`workorder:${workOrderId}`).emit(
              SOCKET_EVENTS.WORKORDER_ACTIVITY,
              payload,
            );
          }
        : undefined,
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
    const io = getSocketServer();
    const adminRoom = data.siteId
      ? `admin:inventory:site:${data.siteId}`
      : "admin:inventory";

    dispatchRealtime(
      "inventory:update",
      adminScope("inventory", data.siteId),
      data,
      io
        ? () => {
            io.to(adminRoom).emit(SOCKET_EVENTS.INVENTORY_UPDATE, data);
            io.to(`user:${data.userId}`).emit(
              SOCKET_EVENTS.INVENTORY_UPDATE,
              data,
            );
          }
        : undefined,
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
    const io = getSocketServer();

    dispatchRealtime(
      "chat:message",
      { kind: "user", id: userId },
      payload,
      io
        ? () => {
            io.to(`user:${userId}`).emit("chat:message", payload);
          }
        : undefined,
    );
  },

  broadcast(event: string, data: unknown) {
    const io = getSocketServer();
    if (io) {
      io.emit(event, data);
    }
  },

  forceLogout(userId: string) {
    const io = getSocketServer();
    const payload = {
      message: "Sesi Anda telah diakhiri oleh administrator",
      timestamp: new Date().toISOString(),
    };

    dispatchRealtime(
      "session:forceLogout",
      { kind: "user", id: userId },
      payload,
      io
        ? () => {
            io.to(`user:${userId}`).emit(SOCKET_EVENTS.FORCE_LOGOUT, payload);
          }
        : undefined,
    );
  },

  profileRefresh(userId: string) {
    const io = getSocketServer();
    const payload = { timestamp: new Date().toISOString() };

    dispatchRealtime(
      "profile:refresh",
      { kind: "user", id: userId },
      payload,
      io
        ? () => {
            io.to(`user:${userId}`).emit(
              SOCKET_EVENTS.PROFILE_REFRESH,
              payload,
            );
          }
        : undefined,
    );
  },
};
