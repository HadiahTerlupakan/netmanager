import type {
  CreateConversationInput,
  CreateMessageInput,
} from "../domain/entities/ChatEntity";
import type { IChatRepository } from "../domain/ports/IChatRepository";
import { ChatConversationRepository } from "./chat-conversation.repository";
import { ChatMessageRepository } from "./chat-message.repository";
import { ChatUserRepository } from "./chat-user.repository";

/** Komposisi repository chat yang menyatukan query per concern. */
export class ChatRepository implements IChatRepository {
  private readonly conversationRepository = new ChatConversationRepository();
  private readonly messageRepository = new ChatMessageRepository();
  private readonly userRepository = new ChatUserRepository();

  /** Ambil semua conversation milik user dalam tenant. */
  async findConversationsForUser(userId: string, tenantId: string) {
    return this.conversationRepository.findConversationsForUser(
      userId,
      tenantId,
    );
  }

  /** Ambil detail conversation berdasarkan ID. */
  async findConversationById(conversationId: string, tenantId: string) {
    return this.conversationRepository.findConversationById(
      conversationId,
      tenantId,
    );
  }

  /** Ambil daftar message conversation dengan cursor pagination. */
  async findMessages(
    conversationId: string,
    tenantId: string,
    options: { cursor?: string; limit?: number } = {},
  ) {
    return this.messageRepository.findMessages(
      conversationId,
      tenantId,
      options,
    );
  }

  /** Buat message baru dalam conversation. */
  async createMessage(input: CreateMessageInput & { tenantId: string }) {
    return this.messageRepository.createMessage(input);
  }

  /** Ambil atau buat global chat untuk tenant. */
  async findOrCreateGlobalChat(tenantId: string) {
    return this.conversationRepository.findOrCreateGlobalChat(tenantId);
  }

  /** Cek apakah user adalah participant conversation. */
  async isParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    return this.messageRepository.isParticipant(
      conversationId,
      userId,
      tenantId,
    );
  }

  /** Tambahkan user sebagai participant conversation. */
  async addParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    return this.messageRepository.addParticipant(
      conversationId,
      userId,
      tenantId,
    );
  }

  /** Update waktu baca terakhir participant. */
  async updateLastRead(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    return this.messageRepository.updateLastRead(
      conversationId,
      userId,
      tenantId,
    );
  }

  /** Buat conversation baru. */
  async createConversation(
    input: CreateConversationInput & { tenantId: string },
  ) {
    return this.conversationRepository.createConversation(input);
  }

  /** Cari direct chat yang sudah ada antara dua user. */
  async findExisting1on1(userIds: string[], tenantId: string) {
    return this.conversationRepository.findExisting1on1(userIds, tenantId);
  }

  /** Ambil participant lain selain user tertentu. */
  async getOtherParticipants(
    conversationId: string,
    excludeUserId: string,
    tenantId: string,
  ) {
    return this.messageRepository.getOtherParticipants(
      conversationId,
      excludeUserId,
      tenantId,
    );
  }

  /** Hitung jumlah participant conversation. */
  async getParticipantCount(conversationId: string, tenantId: string) {
    return this.messageRepository.getParticipantCount(conversationId, tenantId);
  }

  /** Cari user aktif untuk kebutuhan pembuatan chat. */
  async searchUsers(tenantId: string, search?: string, excludeUserId?: string) {
    return this.userRepository.searchUsers(tenantId, search, excludeUserId);
  }

  /** Cek apakah user adalah karyawan tenant. */
  async isEmployeeUser(userId: string, tenantId: string) {
    return this.userRepository.isEmployeeUser(userId, tenantId);
  }

  /** Ambil semua user aktif tenant. */
  async getAllActiveUsers(tenantId: string) {
    return this.userRepository.getAllActiveUsers(tenantId);
  }
}
