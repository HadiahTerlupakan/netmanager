import { logger } from "@/lib/logger";
import type { IChatRepository } from "../domain/ports/IChatRepository";
import type {
  ChatMessageSocketPayload,
  SendMessageInput,
} from "./ChatService.types";
import {
  buildBroadcastTitle,
  buildChatNotificationBody,
  buildChatNotificationTitle,
} from "./chat-formatters";

/** Kelola push notification dan socket event untuk chat. */
export class ChatNotificationService {
  private pushServiceModulePromise?: Promise<
    typeof import("@/modules/notification")
  >;
  private socketEmitterModulePromise?: Promise<
    typeof import("@/lib/websocket/emitter")
  >;

  constructor(private readonly repository: IChatRepository) {}

  /** Kirim push dan socket event untuk pesan chat biasa. */
  async notifyMessageSent(
    input: SendMessageInput,
    message: {
      id: string;
      content: string | null;
      imageUrl: string | null;
      createdAt: Date;
    },
  ): Promise<void> {
    try {
      const otherUserIds = await this.getOtherUserIds(
        input.conversationId,
        input.senderId,
        input.tenantId,
      );
      if (otherUserIds.length === 0) {
        return;
      }

      const conversation = await this.repository.findConversationById(
        input.conversationId,
        input.tenantId,
      );
      await this.sendPushToUsers(
        otherUserIds,
        buildChatNotificationTitle(conversation, input.senderName),
        `${input.senderName}: ${buildChatNotificationBody(message)}`,
        {
          type: "chat_message",
          conversationId: input.conversationId,
          messageId: message.id,
        },
      );
      await this.emitMessageToUsers(otherUserIds, {
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        conversationId: input.conversationId,
        senderId: input.senderId,
        senderName: input.senderName,
        createdAt: message.createdAt.toISOString(),
        isOwn: false,
      });
    } catch (error) {
      logger.error("[Chat] Error sending push notifications:", error);
    }
  }

  /** Kirim push dan socket event untuk pesan broadcast. */
  async notifyBroadcastSent(input: {
    userIds: string[];
    conversationId: string;
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
    title?: string;
  }): Promise<void> {
    if (input.userIds.length === 0) {
      return;
    }

    await this.sendBroadcastPush(input);
    await this.emitBroadcastMessage(input);
  }

  private async getOtherUserIds(
    conversationId: string,
    senderId: string,
    tenantId: string,
  ): Promise<string[]> {
    const otherParticipants = await this.repository.getOtherParticipants(
      conversationId,
      senderId,
      tenantId,
    );
    return otherParticipants.map((participant) => participant.userId);
  }

  private async sendBroadcastPush(input: {
    userIds: string[];
    conversationId: string;
    messageId: string;
    content: string;
    title?: string;
  }): Promise<void> {
    try {
      await this.sendPushToUsers(
        input.userIds,
        buildBroadcastTitle(input.title),
        input.content,
        {
          type: "broadcast",
          conversationId: input.conversationId,
          messageId: input.messageId,
        },
      );
    } catch (error) {
      logger.error("[Chat] Broadcast push error:", error);
    }
  }

  private async emitBroadcastMessage(input: {
    userIds: string[];
    conversationId: string;
    messageId: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  }): Promise<void> {
    try {
      await this.emitMessageToUsers(input.userIds, {
        id: input.messageId,
        content: input.content,
        conversationId: input.conversationId,
        senderId: input.senderId,
        senderName: input.senderName,
        createdAt: input.createdAt.toISOString(),
        isOwn: false,
        isBroadcast: true,
      });
    } catch (error) {
      logger.error("[Chat] Broadcast socket emit error:", error);
    }
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

  private async sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const { sendPushToUsers } = await this.getPushServiceModule();
    await sendPushToUsers(userIds, title, body, data);
  }

  private async emitMessageToUsers(
    userIds: string[],
    payload: ChatMessageSocketPayload,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.emitChatMessage(userId, payload)),
    );
  }

  private async emitChatMessage(
    userId: string,
    payload: ChatMessageSocketPayload,
  ): Promise<void> {
    const { socketEmitter } = await this.getSocketEmitterModule();
    socketEmitter.chatMessage(userId, payload);
  }
}
