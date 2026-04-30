import { logger } from "@/lib/logger";

/** Lazily load notification service for chat events. */
export class ChatNotificationGateway {
  private pushServiceModulePromise?: Promise<
    typeof import("@/modules/notification")
  >;
  private socketEmitterModulePromise?: Promise<
    typeof import("@/lib/websocket/emitter")
  >;

  /** Send push notification to many users. */
  async sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const { sendPushToUsers } = await this.getPushServiceModule();
    return sendPushToUsers(userIds, title, body, data);
  }

  /** Emit chat message payload to a single user socket. */
  async emitChatMessage(
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
    const { socketEmitter } = await this.getSocketEmitterModule();
    socketEmitter.chatMessage(userId, payload);
  }

  /** Emit socket payload to many users with isolated logging. */
  async emitChatMessageToUsers(
    userIds: string[],
    payloadFactory: (userId: string) => {
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
    logContext: string,
  ) {
    userIds.forEach((userId) => {
      this.emitChatMessage(userId, payloadFactory(userId)).catch((error) =>
        logger.error(logContext, error),
      );
    });
  }

  private getPushServiceModule() {
    if (!this.pushServiceModulePromise) {
      this.pushServiceModulePromise = import("@/modules/notification");
    }

    return this.pushServiceModulePromise;
  }

  private getSocketEmitterModule() {
    if (!this.socketEmitterModulePromise) {
      this.socketEmitterModulePromise = import("@/lib/websocket/emitter");
    }

    return this.socketEmitterModulePromise;
  }
}
