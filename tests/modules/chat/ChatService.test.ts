import { beforeEach, describe, expect, it, vi } from "vitest";

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const mockChatRepository = {
  findOrCreateGlobalChat: vi.fn(),
  addParticipant: vi.fn(),
  createMessage: vi.fn(),
  getAllActiveUsers: vi.fn(),
  isEmployeeUser: vi.fn(),
  countActiveEmployees: vi.fn(),
  findExisting1on1: vi.fn(),
  createConversation: vi.fn(),
  isParticipant: vi.fn(),
  findMessages: vi.fn(),
  searchUsers: vi.fn(),
  updateLastRead: vi.fn(),
  getOtherParticipants: vi.fn(),
  findConversationById: vi.fn(),
};

const mockSendPushToActors = vi.fn().mockResolvedValue(1);
const mockChatMessage = vi.fn();

vi.mock("@/modules/notification", () => ({
  sendPushToActors: mockSendPushToActors,
}));

vi.mock("@/modules/chat/repositories/ChatRepository", () => ({
  ChatRepository: class MockChatRepository {
    findOrCreateGlobalChat = mockChatRepository.findOrCreateGlobalChat;
    addParticipant = mockChatRepository.addParticipant;
    createMessage = mockChatRepository.createMessage;
    getAllActiveUsers = mockChatRepository.getAllActiveUsers;
    isEmployeeUser = mockChatRepository.isEmployeeUser;
    countActiveEmployees = mockChatRepository.countActiveEmployees;
    findExisting1on1 = mockChatRepository.findExisting1on1;
    createConversation = mockChatRepository.createConversation;
    isParticipant = mockChatRepository.isParticipant;
    findMessages = mockChatRepository.findMessages;
    searchUsers = mockChatRepository.searchUsers;
    updateLastRead = mockChatRepository.updateLastRead;
    getOtherParticipants = mockChatRepository.getOtherParticipants;
    findConversationById = mockChatRepository.findConversationById;
  },
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    chatMessage: mockChatMessage,
  },
}));

import { CHAT_PESAN } from "@/modules/chat";
import { ChatService } from "@/modules/chat/services/ChatService";

const ADMIN = { type: "user", id: "user-1" } as const;

describe("ChatService", () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService();
    mockChatRepository.isEmployeeUser.mockResolvedValue(true);
  });

  it("publishes broadcast chat messages through socketEmitter for each recipient", async () => {
    const createdAt = new Date("2026-04-09T00:00:00.000Z");

    mockChatRepository.findOrCreateGlobalChat.mockResolvedValueOnce({
      id: "conv-1",
    });
    mockChatRepository.addParticipant.mockResolvedValue(undefined);
    mockChatRepository.createMessage.mockResolvedValueOnce({
      id: "msg-1",
      content: "📢 Ops\n\nServer restart",
      createdAt,
    });
    mockChatRepository.getAllActiveUsers.mockResolvedValueOnce([
      { id: "user-1" },
      { id: "user-2" },
    ]);

    const result = await service.broadcastMessage({
      sender: ADMIN,
      senderName: "Admin",
      tenantId: "tenant-1",
      title: "Ops",
      content: "Server restart",
    });

    await flushAsyncWork();

    expect(result).toMatchObject({ success: true, data: { sentToCount: 2 } });
    expect(mockSendPushToActors).toHaveBeenCalledWith(
      [{ type: "user", id: "user-2" }],
      "Broadcast Ops",
      "Server restart",
      { type: "broadcast", conversationId: "conv-1", messageId: "msg-1" },
    );
    expect(mockChatMessage).toHaveBeenCalledWith("user-2", {
      id: "msg-1",
      content: "Server restart",
      conversationId: "conv-1",
      senderActorType: "user",
      senderActorId: "user-1",
      senderName: "Admin",
      createdAt: "2026-04-09T00:00:00.000Z",
      isOwn: false,
      isBroadcast: true,
    });
  });

  it("pesan chat biasa mengirim push ke penerima lewat kanal FCM-aware", async () => {
    mockChatRepository.isParticipant.mockResolvedValueOnce(true);
    mockChatRepository.createMessage.mockResolvedValueOnce({
      id: "msg-2",
      content: "halo",
      imageUrl: null,
      actorType: "user",
      actorId: "user-1",
      sender: { id: "user-1", name: "Admin", image: null },
      createdAt: new Date("2026-11-02T01:19:38.000Z"),
    });
    mockChatRepository.getOtherParticipants.mockResolvedValueOnce([
      { userId: "user-hp", actorType: "user", actorId: "user-hp" },
    ]);
    mockChatRepository.findConversationById.mockResolvedValueOnce({
      id: "conv-1",
      isGlobal: false,
      name: null,
    });

    const result = await service.sendMessage({
      conversationId: "conv-1",
      sender: ADMIN,
      senderName: "Admin",
      tenantId: "tenant-1",
      content: "halo",
    });
    await flushAsyncWork();

    expect(result.success).toBe(true);
    expect(mockSendPushToActors).toHaveBeenCalledWith(
      [{ type: "user", id: "user-hp" }],
      "Chat Admin",
      "Admin: halo",
      { type: "chat_message", conversationId: "conv-1", messageId: "msg-2" },
    );
  });

  it("menolak broadcast dari mitra/pelanggan dengan pesan, bukan galat 500", async () => {
    const result = await service.broadcastMessage({
      sender: { type: "mitra", id: "mitra-1" },
      senderName: "Mitra",
      tenantId: "tenant-1",
      content: "should fail",
    });

    expect(result).toEqual({
      success: false,
      code: "EMPLOYEE_ONLY",
      error: CHAT_PESAN.EMPLOYEE_ONLY,
    });
    expect(mockChatRepository.createMessage).not.toHaveBeenCalled();
  });

  describe("createConversation", () => {
    it("menolak peserta yang bukan karyawan aktif tenant ini (mis. user tenant lain)", async () => {
      // Pembuat + 1 peserta = 2 id, tapi hanya pembuat yang ada di tenant-1.
      mockChatRepository.countActiveEmployees.mockResolvedValueOnce(1);

      const result = await service.createConversation({
        creator: ADMIN,
        participants: [{ type: "user", id: "user-tenant-lain" }],
        tenantId: "tenant-1",
      });

      expect(result).toMatchObject({
        success: false,
        code: "INVALID_PARTICIPANTS",
      });
      expect(mockChatRepository.countActiveEmployees).toHaveBeenCalledWith(
        ["user-1", "user-tenant-lain"],
        "tenant-1",
      );
      expect(mockChatRepository.createConversation).not.toHaveBeenCalled();
    });

    it("membuat percakapan bila semua peserta karyawan aktif tenant", async () => {
      mockChatRepository.countActiveEmployees.mockResolvedValueOnce(2);
      mockChatRepository.findExisting1on1.mockResolvedValueOnce(null);
      mockChatRepository.createConversation.mockResolvedValueOnce({
        id: "conv-baru",
      });

      const result = await service.createConversation({
        creator: ADMIN,
        participants: [{ type: "user", id: "user-2" }],
        tenantId: "tenant-1",
      });

      expect(result).toEqual({
        success: true,
        data: { id: "conv-baru", isExisting: false },
      });
    });

    it("tidak menghitung pembuat dua kali bila ia memilih dirinya sendiri", async () => {
      mockChatRepository.countActiveEmployees.mockResolvedValueOnce(1);
      mockChatRepository.createConversation.mockResolvedValueOnce({
        id: "conv-sendiri",
      });

      const result = await service.createConversation({
        creator: ADMIN,
        participants: [ADMIN],
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(true);
      expect(mockChatRepository.countActiveEmployees).toHaveBeenCalledWith(
        ["user-1"],
        "tenant-1",
      );
    });

    it("menolak pembuat yang bukan karyawan", async () => {
      const result = await service.createConversation({
        creator: { type: "customer", id: "pelanggan-1" },
        participants: [{ type: "user", id: "user-2" }],
        tenantId: "tenant-1",
      });

      expect(result).toMatchObject({ success: false, code: "EMPLOYEE_ONLY" });
    });
  });

  it("bukan anggota percakapan → NOT_PARTICIPANT, pesan tidak dibaca", async () => {
    mockChatRepository.isParticipant.mockResolvedValueOnce(false);

    const result = await service.getMessages({
      conversationId: "conv-orang-lain",
      actor: ADMIN,
      tenantId: "tenant-1",
    });

    expect(result).toMatchObject({ success: false, code: "NOT_PARTICIPANT" });
    expect(mockChatRepository.findMessages).not.toHaveBeenCalled();
  });

  describe("searchUsers", () => {
    it("mencari di tenant pemanggil dan tidak menampilkan dirinya sendiri", async () => {
      mockChatRepository.searchUsers.mockResolvedValueOnce([
        { id: "user-2", name: "Budi", email: "b@x.id", image: null },
      ]);

      const result = await service.searchUsers(ADMIN, "tenant-1", "bud");

      expect(mockChatRepository.searchUsers).toHaveBeenCalledWith(
        "tenant-1",
        "bud",
        "user-1",
      );
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "user-2", name: "Budi" }],
      });
    });

    it("menolak mitra supaya daftar email karyawan tidak terbuka", async () => {
      const result = await service.searchUsers(
        { type: "mitra", id: "mitra-1" },
        "tenant-1",
      );

      expect(result).toMatchObject({ success: false, code: "EMPLOYEE_ONLY" });
      expect(mockChatRepository.searchUsers).not.toHaveBeenCalled();
    });
  });
});
