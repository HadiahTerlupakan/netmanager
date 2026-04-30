import type { IChatRepository } from "../domain/ports/IChatRepository";
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

  /** Ambil semua conversation chat milik user. */
  async getConversations(userId: string, tenantId: string) {
    const conversations = await this.repository.findConversationsForUser(
      userId,
      tenantId,
    );
    return conversations.map((conversation) =>
      formatConversationListItem(conversation, userId),
    );
  }

  /** Ambil daftar pesan conversation dengan cursor pagination. */
  async getMessages(query: ChatMessagesQuery) {
    await this.ensureParticipant(
      query.conversationId,
      query.userId,
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
      query.userId,
      query.tenantId,
    );
    const conversation = await this.repository.findConversationById(
      query.conversationId,
      query.tenantId,
    );

    return formatConversationMessagesResponse(
      conversation,
      messages,
      query.userId,
      messageLimit,
    );
  }

  /** Kirim pesan ke conversation dan trigger notifikasi penerima. */
  async sendMessage(input: SendMessageInput) {
    await this.ensureParticipant(
      input.conversationId,
      input.senderId,
      input.tenantId,
    );

    const message = await this.repository.createMessage({
      conversationId: input.conversationId,
      senderId: input.senderId,
      tenantId: input.tenantId,
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    });
    await this.repository.updateLastRead(
      input.conversationId,
      input.senderId,
      input.tenantId,
    );
    void this.notificationService.notifyMessageSent(input, message);

    return formatSentMessageResponse(message, input.senderId);
  }

  /** Ambil atau buat global chat tenant untuk user karyawan. */
  async getGlobalChat(userId: string, tenantId: string) {
    await this.ensureEmployeeUser(userId, tenantId);
    const globalChat = await this.repository.findOrCreateGlobalChat(tenantId);
    await this.repository.addParticipant(globalChat.id, userId, tenantId);
    const participantCount = await this.repository.getParticipantCount(
      globalChat.id,
      tenantId,
    );

    return formatGlobalChatResponse(globalChat, participantCount);
  }

  /** Buat conversation baru atau return direct chat yang sudah ada. */
  async createConversation(input: CreateChatInput) {
    await this.ensureEmployeeUser(input.creatorId, input.tenantId);
    const participantIds = [
      ...new Set([input.creatorId, ...input.participantIds]),
    ];
    const existingConversation = await this.findExistingConversation(
      participantIds,
      input.tenantId,
    );
    if (existingConversation) {
      return { id: existingConversation.id, isExisting: true };
    }

    const conversation = await this.repository.createConversation({
      participantIds,
      tenantId: input.tenantId,
      ...(input.name ? { name: input.name } : {}),
    });
    return { id: conversation.id, isExisting: false };
  }

  /** Cari user aktif untuk memulai conversation baru. */
  async searchUsers(tenantId: string, search?: string, excludeUserId?: string) {
    const users = await this.repository.searchUsers(
      tenantId,
      search,
      excludeUserId,
    );
    return users.map(formatUserSearchResult);
  }

  /** Broadcast pesan ke global chat seluruh user aktif tenant. */
  async broadcastMessage(input: BroadcastMessageInput) {
    const globalChat = await this.repository.findOrCreateGlobalChat(
      input.tenantId,
    );
    await this.repository.addParticipant(
      globalChat.id,
      input.senderId,
      input.tenantId,
    );

    const message = await this.repository.createMessage({
      conversationId: globalChat.id,
      senderId: input.senderId,
      tenantId: input.tenantId,
      content: buildBroadcastContent(input),
    });
    const allUsers = await this.repository.getAllActiveUsers(input.tenantId);
    await this.addBroadcastParticipants(
      globalChat.id,
      input.tenantId,
      allUsers.map((user) => user.id),
    );

    const otherUserIds = allUsers
      .filter((user) => user.id !== input.senderId)
      .map((user) => user.id);
    void this.notificationService.notifyBroadcastSent({
      userIds: otherUserIds,
      conversationId: globalChat.id,
      messageId: message.id,
      content: input.content,
      senderId: input.senderId,
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
    participantIds: string[],
    tenantId: string,
  ) {
    if (participantIds.length !== 2) {
      return null;
    }

    return this.repository.findExisting1on1(participantIds, tenantId);
  }

  private async addBroadcastParticipants(
    conversationId: string,
    tenantId: string,
    userIds: string[],
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.repository.addParticipant(conversationId, userId, tenantId),
      ),
    );
  }

  private async ensureParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const isParticipant = await this.repository.isParticipant(
      conversationId,
      userId,
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
