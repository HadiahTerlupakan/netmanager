import { ChatRepository } from "../repositories/ChatRepository";
import type { IChatRepository } from "../domain/ports/IChatRepository";

const GLOBAL_CHAT_NAME = "Global Chat";
const IMAGE_NOTIFICATION_TEXT = "Mengirim gambar";
const NEW_MESSAGE_FALLBACK = "Pesan baru";
const DEFAULT_CHAT_NAME = "Chat";
const DEFAULT_BROADCAST_TITLE = "Broadcast";
const FORBIDDEN_EMPLOYEE_ONLY_MESSAGE =
  "Fitur chat hanya tersedia untuk karyawan.";

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  senderName: string;
  tenantId: string;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateChatInput {
  creatorId: string;
  participantIds: string[];
  tenantId: string;
  name?: string;
}

export interface BroadcastMessageInput {
  senderId: string;
  senderName: string;
  tenantId: string;
  content: string;
  title?: string;
}

export interface ChatMessagesQuery {
  conversationId: string;
  userId: string;
  tenantId: string;
  cursor?: string;
  limit?: number;
}

/**
 * Chat service for business logic.
 */
export class ChatService {
  private pushServiceModulePromise?: Promise<
    typeof import("@/modules/notification")
  >;
  private socketEmitterModulePromise?: Promise<
    typeof import("@/lib/websocket/emitter")
  >;

  constructor(
    private readonly repository: IChatRepository = new ChatRepository(),
  ) {}

  /**
   * Get all conversations for a user.
   */
  async getConversations(userId: string, tenantId: string) {
    const conversations = await this.repository.findConversationsForUser(
      userId,
      tenantId,
    );

    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      const otherParticipants = conversation.participants
        .filter((participant) => participant.userId !== userId)
        .map((participant) => ({
          id: participant.user.id,
          name: participant.user.name,
          image: participant.user.image,
        }));

      const myParticipant = conversation.participants.find(
        (participant) => participant.userId === userId,
      );
      const hasUnread = this.hasUnreadMessage(
        lastMessage,
        myParticipant?.lastReadAt,
      );

      return {
        id: conversation.id,
        name: conversation.isGlobal
          ? GLOBAL_CHAT_NAME
          : conversation.name ||
            otherParticipants.map((item) => item.name).join(", "),
        isGlobal: conversation.isGlobal,
        participants: otherParticipants,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              senderName: lastMessage.sender.name,
              createdAt: lastMessage.createdAt.toISOString(),
            }
          : null,
        hasUnread,
        updatedAt: conversation.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Get messages for a conversation with pagination.
   */
  async getMessages(query: ChatMessagesQuery) {
    await this.ensureParticipant(
      query.conversationId,
      query.userId,
      query.tenantId,
    );
    const messageLimit = query.limit || 50;
    const messages = await this.repository.findMessages(
      query.conversationId,
      query.tenantId,
      {
        limit: messageLimit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    );

    const hasMore = messages.length > messageLimit;
    const displayMessages = hasMore ? messages.slice(0, -1) : messages;

    await this.repository.updateLastRead(
      query.conversationId,
      query.userId,
      query.tenantId,
    );
    const conversation = await this.repository.findConversationById(
      query.conversationId,
      query.tenantId,
    );

    return {
      conversation: {
        id: conversation?.id,
        name: conversation?.isGlobal ? GLOBAL_CHAT_NAME : conversation?.name,
        isGlobal: conversation?.isGlobal,
        participants: conversation?.participants.map((participant) => ({
          id: participant.user.id,
          name: participant.user.name,
          image: participant.user.image,
        })),
      },
      messages: displayMessages.map((message) => ({
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        senderId: message.senderId,
        senderName: message.sender.name,
        senderImage: message.sender.image,
        createdAt: message.createdAt.toISOString(),
        isOwn: message.senderId === query.userId,
      })),
      hasMore,
      nextCursor: hasMore
        ? displayMessages[displayMessages.length - 1]?.id
        : null,
    };
  }

  /**
   * Send a message to a conversation.
   */
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
    this.sendPushNotifications(input, message);

    return {
      id: message.id,
      content: message.content,
      imageUrl: message.imageUrl,
      senderId: message.senderId,
      senderName: message.sender.name,
      senderImage: message.sender.image,
      createdAt: message.createdAt.toISOString(),
      isOwn: true,
    };
  }

  /**
   * Get or create global chat and add user as participant.
   */
  async getGlobalChat(userId: string, tenantId: string) {
    await this.ensureEmployeeUser(userId, tenantId);
    const globalChat = await this.repository.findOrCreateGlobalChat(tenantId);
    await this.repository.addParticipant(globalChat.id, userId, tenantId);
    const participantCount = await this.repository.getParticipantCount(
      globalChat.id,
      tenantId,
    );

    return {
      id: globalChat.id,
      name: GLOBAL_CHAT_NAME,
      isGlobal: true,
      participantCount,
    };
  }

  /**
   * Create a new conversation.
   */
  async createConversation(input: CreateChatInput) {
    await this.ensureEmployeeUser(input.creatorId, input.tenantId);
    const allParticipantIds = [
      ...new Set([input.creatorId, ...input.participantIds]),
    ];

    if (allParticipantIds.length === 2) {
      const existing = await this.repository.findExisting1on1(
        allParticipantIds,
        input.tenantId,
      );
      if (existing) {
        return { id: existing.id, isExisting: true };
      }
    }

    const conversation = await this.repository.createConversation({
      participantIds: allParticipantIds,
      tenantId: input.tenantId,
      ...(input.name ? { name: input.name } : {}),
    });

    return { id: conversation.id, isExisting: false };
  }

  /**
   * Search users for creating new chat.
   */
  async searchUsers(tenantId: string, search?: string, excludeUserId?: string) {
    const users = await this.repository.searchUsers(
      tenantId,
      search,
      excludeUserId,
    );

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      department: user.departments?.name,
      site: user.sites?.name,
    }));
  }

  /**
   * Broadcast message to all active users in tenant.
   */
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
      content: `📢 ${input.title || DEFAULT_BROADCAST_TITLE}\n\n${input.content}`,
    });

    const allUsers = await this.repository.getAllActiveUsers(input.tenantId);
    for (const user of allUsers) {
      await this.repository.addParticipant(
        globalChat.id,
        user.id,
        input.tenantId,
      );
    }

    const otherUserIds = allUsers
      .filter((user) => user.id !== input.senderId)
      .map((user) => user.id);
    if (otherUserIds.length > 0) {
      this.sendPushToUsers(
        otherUserIds,
        `📢 ${input.title || DEFAULT_BROADCAST_TITLE}`,
        input.content,
        {
          type: "broadcast",
          conversationId: globalChat.id,
          messageId: message.id,
        },
      ).catch((error) => console.error("[Chat] Broadcast push error:", error));

      otherUserIds.forEach((otherUserId) => {
        this.emitChatMessage(otherUserId, {
          id: message.id,
          content: message.content,
          conversationId: globalChat.id,
          senderId: input.senderId,
          senderName: input.senderName,
          createdAt: message.createdAt.toISOString(),
          isOwn: false,
          isBroadcast: true,
        }).catch((error) =>
          console.error("[Chat] Broadcast socket emit error:", error),
        );
      });
    }

    return {
      id: message.id,
      content: message.content,
      sentToCount: allUsers.length,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private hasUnreadMessage(
    lastMessage: { createdAt: Date } | undefined,
    lastReadAt?: Date | null,
  ) {
    if (!lastMessage) {
      return false;
    }

    if (!lastReadAt) {
      return true;
    }

    return new Date(lastMessage.createdAt) > new Date(lastReadAt);
  }

  private async ensureParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    const isParticipant = await this.repository.isParticipant(
      conversationId,
      userId,
      tenantId,
    );
    if (!isParticipant) {
      throw new Error("Not a participant");
    }
  }

  private async ensureEmployeeUser(userId: string, tenantId: string) {
    const isEmployeeUser = await this.repository.isEmployeeUser(
      userId,
      tenantId,
    );
    if (!isEmployeeUser) {
      throw new Error(FORBIDDEN_EMPLOYEE_ONLY_MESSAGE);
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
  ) {
    const { sendPushToUsers } = await this.getPushServiceModule();
    return sendPushToUsers(userIds, title, body, data);
  }

  private async emitChatMessage(
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

  private async sendPushNotifications(
    input: SendMessageInput,
    message: {
      id: string;
      content: string | null;
      imageUrl: string | null;
      createdAt: Date;
    },
  ) {
    try {
      const otherParticipants = await this.repository.getOtherParticipants(
        input.conversationId,
        input.senderId,
        input.tenantId,
      );

      if (otherParticipants.length === 0) {
        return;
      }

      const otherUserIds = otherParticipants.map(
        (participant) => participant.userId,
      );
      const conversation = await this.repository.findConversationById(
        input.conversationId,
        input.tenantId,
      );
      const chatName = conversation?.isGlobal
        ? GLOBAL_CHAT_NAME
        : conversation?.name || input.senderName || DEFAULT_CHAT_NAME;
      const notificationBody = message.imageUrl
        ? IMAGE_NOTIFICATION_TEXT
        : message.content || NEW_MESSAGE_FALLBACK;

      await this.sendPushToUsers(
        otherUserIds,
        `💬 ${chatName}`,
        `${input.senderName}: ${notificationBody}`,
        {
          type: "chat_message",
          conversationId: input.conversationId,
          messageId: message.id,
        },
      );

      otherUserIds.forEach((otherUserId) => {
        this.emitChatMessage(otherUserId, {
          id: message.id,
          content: message.content,
          imageUrl: message.imageUrl,
          conversationId: input.conversationId,
          senderId: input.senderId,
          senderName: input.senderName,
          createdAt: message.createdAt.toISOString(),
          isOwn: false,
        }).catch((error) => console.error("[Chat] Socket emit error:", error));
      });
    } catch (error) {
      console.error("[Chat] Error sending push notifications:", error);
    }
  }
}
