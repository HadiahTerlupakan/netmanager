import type { IChatRepository } from "../domain/ports/IChatRepository";
import type { ChatActor } from "../domain/entities/ChatEntity";
import { DEFAULT_MESSAGE_LIMIT } from "../domain/chat.constants";
import { chatGagal, chatOk, type ChatResult } from "../domain/chat-result";
import { ChatRepository } from "../repositories/ChatRepository";
import { ActorSummaryLookup } from "./actor-resolver";
import { ChatNotificationService } from "./chat-notification.service";
import type {
  BroadcastMessageInput,
  ChatMessagesQuery,
  CreateChatInput,
  SendMessageInput,
} from "./ChatService.types";
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

type MessagesPage = Awaited<
  ReturnType<typeof formatConversationMessagesResponse>
>;
type SentMessage = Awaited<ReturnType<typeof formatSentMessageResponse>>;
type UserSearchItem = ReturnType<typeof formatUserSearchResult>;
type CreatedConversation = { id: string; isExisting: boolean };
type BroadcastSummary = {
  id: string;
  content: string | null;
  sentToCount: number;
  createdAt: string;
};

/**
 * Orkestrasi fitur chat. Pelanggaran aturan (bukan peserta, bukan karyawan,
 * peserta dari luar tenant) dikembalikan sebagai `ChatResult` gagal supaya
 * route menjawab 4xx dengan pesan yang jelas, bukan 500.
 */
export class ChatService {
  private readonly notificationService: ChatNotificationService;

  constructor(
    private readonly repository: IChatRepository = new ChatRepository(),
  ) {
    this.notificationService = new ChatNotificationService(repository);
  }

  /** Ambil semua conversation milik actor. */
  async getConversations(actor: ChatActor, tenantId: string) {
    const conversations = await this.repository.findConversationsForUser(
      actor,
      tenantId,
    );
    const lookup = new ActorSummaryLookup();
    return Promise.all(
      conversations.map((conversation) =>
        formatConversationListItem(conversation, actor, lookup),
      ),
    );
  }

  /** Ambil daftar pesan conversation dengan cursor pagination. */
  async getMessages(
    query: ChatMessagesQuery,
  ): Promise<ChatResult<MessagesPage>> {
    if (
      !(await this.isParticipant(
        query.conversationId,
        query.actor,
        query.tenantId,
      ))
    ) {
      return chatGagal("NOT_PARTICIPANT");
    }

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

    return chatOk(
      await formatConversationMessagesResponse(
        conversation,
        messages,
        query.actor,
        messageLimit,
      ),
    );
  }

  /** Kirim pesan ke conversation dan trigger notifikasi penerima. */
  async sendMessage(input: SendMessageInput): Promise<ChatResult<SentMessage>> {
    if (
      !(await this.isParticipant(
        input.conversationId,
        input.sender,
        input.tenantId,
      ))
    ) {
      return chatGagal("NOT_PARTICIPANT");
    }

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

    return chatOk(await formatSentMessageResponse(message, input.sender));
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

  /**
   * Buat conversation baru atau kembalikan direct chat yang sudah ada.
   * Pembuat dan semua peserta wajib karyawan aktif tenant yang sama.
   */
  async createConversation(
    input: CreateChatInput,
  ): Promise<ChatResult<CreatedConversation>> {
    if (!(await this.isEmployee(input.creator, input.tenantId))) {
      return chatGagal("EMPLOYEE_ONLY");
    }
    const participants = uniqueActors([input.creator, ...input.participants]);
    if (!(await this.areActiveEmployees(participants, input.tenantId))) {
      return chatGagal("INVALID_PARTICIPANTS");
    }

    const existingConversation = await this.findExistingConversation(
      participants,
      input.tenantId,
    );
    if (existingConversation) {
      return chatOk({ id: existingConversation.id, isExisting: true });
    }

    const conversation = await this.repository.createConversation({
      participants,
      tenantId: input.tenantId,
      ...(input.name ? { name: input.name } : {}),
    });
    return chatOk({ id: conversation.id, isExisting: false });
  }

  /** Cari karyawan aktif untuk diajak chat; hanya untuk akun karyawan. */
  async searchUsers(
    actor: ChatActor,
    tenantId: string,
    search?: string,
  ): Promise<ChatResult<UserSearchItem[]>> {
    if (actor.type !== "user") {
      return chatGagal("EMPLOYEE_ONLY");
    }
    const users = await this.repository.searchUsers(tenantId, search, actor.id);
    return chatOk(users.map(formatUserSearchResult));
  }

  /** Broadcast pesan ke global chat seluruh user aktif tenant. */
  async broadcastMessage(
    input: BroadcastMessageInput,
  ): Promise<ChatResult<BroadcastSummary>> {
    if (!(await this.isEmployee(input.sender, input.tenantId))) {
      return chatGagal("EMPLOYEE_ONLY");
    }

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
    const allActors = allUsers.map((user) => employeeActor(user.id));
    await this.addBroadcastParticipants(
      globalChat.id,
      input.tenantId,
      allActors,
    );

    void this.notificationService.notifyBroadcastSent({
      recipients: allActors.filter((actor) => actor.id !== input.sender.id),
      conversationId: globalChat.id,
      messageId: message.id,
      content: input.content,
      sender: input.sender,
      senderName: input.senderName,
      createdAt: message.createdAt,
      title: input.title,
    });

    return chatOk({
      id: message.id,
      content: message.content,
      sentToCount: allUsers.length,
      createdAt: message.createdAt.toISOString(),
    });
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

  private isParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ): Promise<boolean> {
    return this.repository.isParticipant(conversationId, actor, tenantId);
  }

  private async isEmployee(actor: ChatActor, tenantId: string) {
    return (
      actor.type === "user" &&
      (await this.repository.isEmployeeUser(actor.id, tenantId))
    );
  }

  /** Semua peserta karyawan aktif tenant ini; mitra/pelanggan tidak diundang. */
  private async areActiveEmployees(actors: ChatActor[], tenantId: string) {
    if (actors.some((actor) => actor.type !== "user")) {
      return false;
    }
    const userIds = actors.map((actor) => actor.id);
    const activeCount = await this.repository.countActiveEmployees(
      userIds,
      tenantId,
    );
    return activeCount === userIds.length;
  }
}

function employeeActor(userId: string): ChatActor {
  return { type: "user", id: userId };
}

/** Buang aktor ganda (mis. pembuat ikut memilih dirinya sendiri). */
function uniqueActors(actors: ChatActor[]): ChatActor[] {
  return Array.from(
    new Map(
      actors.map((actor) => [`${actor.type}:${actor.id}`, actor]),
    ).values(),
  );
}
