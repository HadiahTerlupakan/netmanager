import { logger } from "@/lib/logger";
import type { IChatRepository } from "../domain/ports/IChatRepository";
import { ChatNotificationService } from "./ChatNotificationService";

const DEFAULT_BROADCAST_TITLE = "Broadcast";

interface BroadcastMessageInput {
  senderId: string;
  senderName: string;
  tenantId: string;
  content: string;
  title?: string;
}

export class ChatBroadcastService {
  constructor(
    private readonly repository: IChatRepository,
    private readonly notificationService: ChatNotificationService,
  ) {}

  /** Broadcast pesan ke semua user aktif dalam tenant. */
  async broadcastMessage(input: BroadcastMessageInput) {
    const globalChat = await this.repository.findOrCreateGlobalChat(
      input.tenantId,
    );
    await this.repository.addParticipant(
      globalChat.id,
      input.senderId,
      input.tenantId,
    );
    const message = await this.createBroadcastMessage(globalChat.id, input);
    const allUsers = await this.repository.getAllActiveUsers(input.tenantId);
    await this.addBroadcastParticipants(
      globalChat.id,
      input.tenantId,
      allUsers,
    );
    await this.notifyBroadcastRecipients(
      input,
      globalChat.id,
      message,
      allUsers,
    );
    return {
      id: message.id,
      content: message.content,
      sentToCount: allUsers.length,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private createBroadcastMessage(
    conversationId: string,
    input: BroadcastMessageInput,
  ) {
    return this.repository.createMessage({
      conversationId,
      senderId: input.senderId,
      tenantId: input.tenantId,
      content: `📢 ${input.title || DEFAULT_BROADCAST_TITLE}\n\n${input.content}`,
    });
  }

  private async addBroadcastParticipants(
    conversationId: string,
    tenantId: string,
    users: Array<{ id: string }>,
  ) {
    for (const user of users) {
      await this.repository.addParticipant(conversationId, user.id, tenantId);
    }
  }

  private async notifyBroadcastRecipients(
    input: BroadcastMessageInput,
    conversationId: string,
    message: { id: string; content: string | null; createdAt: Date },
    users: Array<{ id: string }>,
  ) {
    const recipientIds = users
      .filter((user) => user.id !== input.senderId)
      .map((user) => user.id);
    if (!recipientIds.length) return;
    await this.notificationService
      .send({
        userIds: recipientIds,
        title: `📢 ${input.title || DEFAULT_BROADCAST_TITLE}`,
        body: input.content,
        data: { type: "broadcast", conversationId, messageId: message.id },
        payloads: this.buildBroadcastPayloads(
          input,
          conversationId,
          message,
          recipientIds,
        ),
      })
      .catch((error) =>
        logger.error("[Chat] Broadcast notification error:", error),
      );
  }

  private buildBroadcastPayloads(
    input: BroadcastMessageInput,
    conversationId: string,
    message: { id: string; content: string | null; createdAt: Date },
    recipientIds: string[],
  ) {
    return recipientIds.map((userId) => ({
      userId,
      payload: {
        id: message.id,
        content: message.content,
        conversationId,
        senderId: input.senderId,
        senderName: input.senderName,
        createdAt: message.createdAt.toISOString(),
        isOwn: false,
        isBroadcast: true,
      },
    }));
  }
}
