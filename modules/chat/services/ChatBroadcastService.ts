import { logger } from "@/lib/logger";
import type { ChatActor } from "../domain/entities/ChatEntity";
import type { IChatRepository } from "../domain/ports/IChatRepository";
import { ChatNotificationService } from "./chat-notification.service";

const DEFAULT_BROADCAST_TITLE = "Broadcast";

interface BroadcastMessageInput {
  sender: ChatActor;
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
      input.sender,
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
      sender: input.sender,
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
      await this.repository.addParticipant(
        conversationId,
        { type: "user", id: user.id },
        tenantId,
      );
    }
  }

  private async notifyBroadcastRecipients(
    input: BroadcastMessageInput,
    conversationId: string,
    message: { id: string; content: string | null; createdAt: Date },
    users: Array<{ id: string }>,
  ) {
    const recipients: ChatActor[] = users
      .filter((user) => user.id !== input.sender.id)
      .map((user) => ({ type: "user", id: user.id }));
    if (!recipients.length) return;
    await this.notificationService
      .notifyBroadcastSent({
        recipients,
        conversationId,
        messageId: message.id,
        content: input.content,
        sender: input.sender,
        senderName: input.senderName,
        createdAt: message.createdAt,
        title: input.title,
      })
      .catch((error) =>
        logger.error("[Chat] Broadcast notification error:", error),
      );
  }
}
