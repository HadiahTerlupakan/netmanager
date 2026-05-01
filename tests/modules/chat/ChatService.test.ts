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
};

const mockSendPushToUsers = vi.fn().mockResolvedValue(undefined);
const mockChatMessage = vi.fn();

vi.mock("@/modules/notification", () => ({
  sendPushToUsers: mockSendPushToUsers,
}));

vi.mock("@/modules/chat/repositories/ChatRepository", () => ({
  ChatRepository: class MockChatRepository {
    findOrCreateGlobalChat = mockChatRepository.findOrCreateGlobalChat;
    addParticipant = mockChatRepository.addParticipant;
    createMessage = mockChatRepository.createMessage;
    getAllActiveUsers = mockChatRepository.getAllActiveUsers;
  },
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    chatMessage: mockChatMessage,
  },
}));

import { ChatService } from "@/modules/chat/services/ChatService";

describe("ChatService", () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService();
  });

  it("publishes broadcast chat messages through socketEmitter instead of the legacy helper", async () => {
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

    await service.broadcastMessage({
      senderId: "user-1",
      senderName: "Admin",
      tenantId: "tenant-1",
      title: "Ops",
      content: "Server restart",
    });

    await flushAsyncWork();

    expect(mockChatMessage).toHaveBeenCalledWith("user-2", {
      id: "msg-1",
      content: "Server restart",
      conversationId: "conv-1",
      senderId: "user-1",
      senderName: "Admin",
      createdAt: "2026-04-09T00:00:00.000Z",
      isOwn: false,
      isBroadcast: true,
    });
  });
});
