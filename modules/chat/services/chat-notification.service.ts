import { logger } from "@/lib/logger";
import type { ChatActor } from "../domain/entities/ChatEntity";
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
      const otherParticipants = await this.getOtherParticipants(
        input.conversationId,
        input.sender,
        input.tenantId,
      );
      if (otherParticipants.length === 0) {
        return;
      }

      const conversation = await this.repository.findConversationById(
        input.conversationId,
        input.tenantId,
      );
      await this.sendPushToActors(
        otherParticipants,
        buildChatNotificationTitle(conversation, input.senderName),
        `${input.senderName}: ${buildChatNotificationBody(message)}`,
        {
          type: "chat_message",
          conversationId: input.conversationId,
          messageId: message.id,
        },
      );
      await this.emitMessageToActors(otherParticipants, {
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        conversationId: input.conversationId,
        senderActorType: input.sender.type,
        senderActorId: input.sender.id,
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
    recipients: ChatActor[];
    conversationId: string;
    messageId: string;
    content: string;
    sender: ChatActor;
    senderName: string;
    createdAt: Date;
    title?: string;
  }): Promise<void> {
    if (input.recipients.length === 0) {
      return;
    }

    await this.sendBroadcastPush(input);
    await this.emitBroadcastMessage(input);
  }

  private async getOtherParticipants(
    conversationId: string,
    sender: ChatActor,
    tenantId: string,
  ): Promise<ChatActor[]> {
    const participants = await this.repository.getOtherParticipants(
      conversationId,
      sender,
      tenantId,
    );
    return participants
      .filter((p) => p.actorId && p.actorType)
      .map((p) => ({
        type: p.actorType as ChatActor["type"],
        id: p.actorId as string,
      }));
  }

  private async sendBroadcastPush(input: {
    recipients: ChatActor[];
    conversationId: string;
    messageId: string;
    content: string;
    title?: string;
  }): Promise<void> {
    try {
      await this.sendPushToActors(
        input.recipients,
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
    recipients: ChatActor[];
    conversationId: string;
    messageId: string;
    content: string;
    sender: ChatActor;
    senderName: string;
    createdAt: Date;
  }): Promise<void> {
    try {
      await this.emitMessageToActors(input.recipients, {
        id: input.messageId,
        content: input.content,
        conversationId: input.conversationId,
        senderActorType: input.sender.type,
        senderActorId: input.sender.id,
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

  private async sendPushToActors(
    actors: ChatActor[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const { sendPushToUsers } = await this.getPushServiceModule();
    // sendPushToUsers sudah actor-aware: fallback ke mitra repo jika id tidak
    // ditemukan di User. Mitra/pelanggan/user id bisa langsung dilewat.
    await sendPushToUsers(
      actors.map((actor) => actor.id),
      title,
      body,
      data,
    );
  }

  private async emitMessageToActors(
    actors: ChatActor[],
    payload: ChatMessageSocketPayload,
  ): Promise<void> {
    await Promise.all(
      actors.map((actor) => this.emitChatMessage(actor, payload)),
    );
  }

  private async emitChatMessage(
    actor: ChatActor,
    payload: ChatMessageSocketPayload,
  ): Promise<void> {
    const { socketEmitter } = await this.getSocketEmitterModule();
    // Firebase realtime path `users/{id}/events` dipakai untuk semua actor
    // (mitra subscribe pakai mitra id → path sama). Payload tidak berubah.
    socketEmitter.chatMessage(actor.id, payload as never);
  }
}
