import { logger } from "@/lib/logger";

interface ChatMessagePayload {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  conversationId: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
  isBroadcast?: boolean;
}

interface SendMessageNotificationInput {
  userIds: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  payloads: Array<{ userId: string; payload: ChatMessagePayload }>;
}

export class ChatNotificationService {
  private pushServiceModulePromise?: Promise<
    typeof import("@/modules/notification")
  >;
  private socketEmitterModulePromise?: Promise<
    typeof import("@/lib/websocket/emitter")
  >;

  /** Kirim push notification dan socket event chat. */
  async send(input: SendMessageNotificationInput): Promise<void> {
    await this.sendPush(input.userIds, input.title, input.body, input.data);
    this.emitMessages(input.payloads);
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

  private async sendPush(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    const { sendPushToUsers } = await this.getPushServiceModule();
    return sendPushToUsers(userIds, title, body, data);
  }

  private emitMessages(
    payloads: Array<{ userId: string; payload: ChatMessagePayload }>,
  ) {
    payloads.forEach(({ userId, payload }) => {
      this.emitChatMessage(userId, payload).catch((error) =>
        logger.error("[Chat] Socket emit error:", error),
      );
    });
  }

  private async emitChatMessage(userId: string, payload: ChatMessagePayload) {
    const { socketEmitter } = await this.getSocketEmitterModule();
    socketEmitter.chatMessage(userId, payload);
  }
}
