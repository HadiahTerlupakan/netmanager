import type { IChatRepository } from "../domain/ports/IChatRepository";
import type { ChatActor } from "../domain/entities/ChatEntity";
import { ChatRepository } from "../repositories/ChatRepository";
import { ChatNotificationService } from "./chat-notification.service";
import type {
  BroadcastMessageInput,
  ChatMessagesQuery,
  CreateChatInput,
  SendMessageInput,
} from "./ChatService.types";
import {
  DEFAULT_MESSAGE_LIMIT,
  FORBIDDEN_EMPLOYEE_ONLY_MESSAGE,
} from "./chat.constants";
import {
  buildBroadcastContent,
  formatConversationListItem,
  formatConversationMessagesResponse,
  formatGlobalChatResponse,
  formatSentMessageResponse,
  formatUserSearchResult,
} from "./chat-formatters";

export type {
  BroadcastMessageInput,
  ChatMessagesQuery,
  CreateChatInput,
  SendMessageInput,
} from "./ChatService.types";

/** Menangani orkestrasi bisnis utama fitur chat. */
export class ChatService {
  private readonly notificationService: ChatNotificationService;

  constructor(
    private readonly repository: IChatRepository = new ChatRepository(),
  ) {
    this.notificationService = new ChatNotificationService(repository);
  }

  /** Ambil semua conversation chat milik actor. */
  async getConversations(actor: ChatActor, tenantId: string) {
    const conversations = await this.repository.findConversationsForUser(
      actor,
      tenantId,
    );
    return Promise.all(
      conversations.map((conversation) =>
        formatConversationListItem(conversation, actor),
      ),
    );
  }

  /** Ambil daftar pesan conversation dengan cursor pagination. */
  async getMessages(query: ChatMessagesQuery) {
    await this.ensureParticipant(
      query.conversationId,
      query.actor,
      query.tenantId,
    );

    const messageLimit = query.limit ?? DEFAULT_MESSAGE_LIMIT;
    const messages = await this.repository.findMessages(
      query.conversationId,
      query.tenantId,
      {
        limit: messageLimit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    );
    await this.repository.updateLastRead(
      query.conversationId,
      query.actor,
      query.tenantId,
    );
    const conversation = await this.repository.findConversationById(
      query.conversationId,
      query.tenantId,
    );

    return formatConversationMessagesResponse(
      conversation,
      messages,
      query.actor,
      messageLimit,
    );
  }

  /** Kirim pesan ke conversation dan trigger notifikasi penerima. */
  async sendMessage(input: SendMessageInput) {
    await this.ensureParticipant(
      input.conversationId,
      input.sender,
      input.tenantId,
    );

    const message = await this.repository.createMessage({
      conversationId: input.conversationId,
      sender: input.sender,
      tenantId: input.tenantId,
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    });
    await this.repository.updateLastRead(
      input.conversationId,
      input.sender,
      input.tenantId,
    );
    void this.notificationService.notifyMessageSent(input, message);

    return formatSentMessageResponse(message, input.sender);
  }

  /** Ambil atau buat global chat tenant untuk actor apapun. */
  async getGlobalChat(actor: ChatActor, tenantId: string) {
    const globalChat = await this.repository.findOrCreateGlobalChat(tenantId);
    await this.repository.addParticipant(globalChat.id, actor, tenantId);
    const participantCount = await this.repository.getParticipantCount(
      globalChat.id,
      tenantId,
    );

    return formatGlobalChatResponse(globalChat, participantCount);
  }

  /** Buat conversation baru atau return direct chat yang sudah ada. */
  async createConversation(input: CreateChatInput) {
    if (input.creator.type !== "user") {
      // Mitra/pelanggan tidak dapat membuat conversation baru (hanya join/reply).
      throw new Error(FORBIDDEN_EMPLOYEE_ONLY_MESSAGE);
    }
    await this.ensureEmployeeUser(input.creator.id, input.tenantId);
    const participants = Array.from(
      new Map(
        [input.creator, ...input.participants].map((a) => [
          `${a.type}:${a.id}`,
          a,
        ]),
      ).values(),
    );
    const existingConversation = await this.findExistingConversation(
      participants,
      input.tenantId,
    );
    if (existingConversation) {
      return { id: existingConversation.id, isExisting: true };
    }

    const conversation = await this.repository.createConversation({
      participants,
      tenantId: input.tenantId,
      ...(input.name ? { name: input.name } : {}),
    });
    return { id: conversation.id, isExisting: false };
  }

  /** Cari user aktif untuk memulai conversation baru. */
  async searchUsers(
    tenantId: string,
    search?: string,
    excludeActorId?: string,
  ) {
    const users = await this.repository.searchUsers(
      tenantId,
      search,
      excludeActorId,
    );
    return users.map(formatUserSearchResult);
  }

  /** Broadcast pesan ke global chat seluruh user aktif tenant. */
  async broadcastMessage(input: BroadcastMessageInput) {
    if (input.sender.type !== "user") {
      throw new Error(FORBIDDEN_EMPLOYEE_ONLY_MESSAGE);
    }
    await this.ensureEmployeeUser(input.sender.id, input.tenantId);

    const globalChat = await this.repository.findOrCreateGlobalChat(
      input.tenantId,
    );
    await this.repository.addParticipant(
      globalChat.id,
      input.sender,
      input.tenantId,
    );

    const message = await this.repository.createMessage({
      conversationId: globalChat.id,
      sender: input.sender,
      tenantId: input.tenantId,
      content: buildBroadcastContent(input),
    });
    const allUsers = await this.repository.getAllActiveUsers(input.tenantId);
    await this.addBroadcastParticipants(
      globalChat.id,
      input.tenantId,
      allUsers.map((user) => ({ type: "user", id: user.id }) as ChatActor),
    );

    const otherActors = allUsers
      .filter((user) => user.id !== input.sender.id)
      .map((user) => ({ type: "user", id: user.id }) as ChatActor);
    void this.notificationService.notifyBroadcastSent({
      recipients: otherActors,
      conversationId: globalChat.id,
      messageId: message.id,
      content: input.content,
      sender: input.sender,
      senderName: input.senderName,
      createdAt: message.createdAt,
      title: input.title,
    });

    return {
      id: message.id,
      content: message.content,
      sentToCount: allUsers.length,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async findExistingConversation(
    participants: ChatActor[],
    tenantId: string,
  ) {
    if (participants.length !== 2) {
      return null;
    }

    return this.repository.findExisting1on1(
      [participants[0], participants[1]],
      tenantId,
    );
  }

  private async addBroadcastParticipants(
    conversationId: string,
    tenantId: string,
    actors: ChatActor[],
  ): Promise<void> {
    await Promise.all(
      actors.map((actor) =>
        this.repository.addParticipant(conversationId, actor, tenantId),
      ),
    );
  }

  private async ensureParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ): Promise<void> {
    const isParticipant = await this.repository.isParticipant(
      conversationId,
      actor,
      tenantId,
    );
    if (!isParticipant) {
      throw new Error("Not a participant");
    }
  }

  private async ensureEmployeeUser(
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const isEmployeeUser = await this.repository.isEmployeeUser(
      userId,
      tenantId,
    );
    if (!isEmployeeUser) {
      throw new Error(FORBIDDEN_EMPLOYEE_ONLY_MESSAGE);
    }
  }
}
