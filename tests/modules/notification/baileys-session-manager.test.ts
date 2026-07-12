import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMessage = vi.fn();
const mockEnd = vi.fn();
const mockOn = vi.fn();
const mockSaveCreds = vi.fn();

vi.mock("@whiskeysockets/baileys", () => {
  const DisconnectReason = { loggedOut: 401 };
  const makeWASocket = vi.fn(() => ({
    sendMessage: mockSendMessage,
    end: mockEnd,
    user: { id: "6281234567890:1@s.whatsapp.net" },
    ev: { on: mockOn },
  }));
  return {
    default: makeWASocket,
    useMultiFileAuthState: vi.fn(async () => ({
      state: { creds: {}, keys: {} },
      saveCreds: mockSaveCreds,
    })),
    DisconnectReason,
    fetchLatestBaileysVersion: vi.fn(async () => ({ version: [2, 3000, 0] })),
  };
});

vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
}));

describe("baileys-session-manager", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSendMessage.mockReset();
    mockEnd.mockReset();
    mockOn.mockReset();
    mockSaveCreds.mockReset();
  });

  it("starts disconnected and reports status after start", async () => {
    const manager =
      await import("@/modules/notification/services/whatsapp/baileys-session-manager");

    expect(manager.getBaileysSession("acc-1").status).toBe("disconnected");

    await manager.startBaileysSession("acc-1");
    expect(manager.getBaileysSession("acc-1").status).toBe("connecting");

    const connectionHandler = mockOn.mock.calls.find(
      (call) => call[0] === "connection.update",
    )?.[1] as
      | ((update: { connection?: string; qr?: string }) => void)
      | undefined;

    expect(connectionHandler).toBeTypeOf("function");
    connectionHandler?.({ connection: "open" });

    const info = manager.getBaileysSession("acc-1");
    expect(info.status).toBe("connected");
    expect(info.phone).toBe("6281234567890");
  });

  it("rejects send when session is not connected", async () => {
    const manager =
      await import("@/modules/notification/services/whatsapp/baileys-session-manager");

    const result = await manager.sendBaileysMessage(
      "missing",
      "628111111111",
      "halo",
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("belum terkoneksi");
  });

  it("sends message when session is connected", async () => {
    const manager =
      await import("@/modules/notification/services/whatsapp/baileys-session-manager");

    await manager.startBaileysSession("acc-2");
    const connectionHandler = mockOn.mock.calls.find(
      (call) => call[0] === "connection.update",
    )?.[1] as ((update: { connection?: string }) => void) | undefined;
    connectionHandler?.({ connection: "open" });

    mockSendMessage.mockResolvedValue({ key: { id: "msg-1" } });
    const result = await manager.sendBaileysMessage(
      "acc-2",
      "628222222222",
      "halo baileys",
    );

    expect(result).toEqual({ success: true, messageId: "msg-1" });
    expect(mockSendMessage).toHaveBeenCalledWith(
      "628222222222@s.whatsapp.net",
      {
        text: "halo baileys",
      },
    );
  });

  it("BaileysProvider uses accountId as session key", async () => {
    const { BaileysProvider } =
      await import("@/modules/notification/services/whatsapp/providers/baileys-provider");
    const manager =
      await import("@/modules/notification/services/whatsapp/baileys-session-manager");

    await manager.startBaileysSession("acct-xyz");
    const connectionHandler = mockOn.mock.calls.find(
      (call) => call[0] === "connection.update",
    )?.[1] as ((update: { connection?: string }) => void) | undefined;
    connectionHandler?.({ connection: "open" });
    mockSendMessage.mockResolvedValue({ key: { id: "msg-2" } });

    const provider = new BaileysProvider({
      provider: "BAILEYS",
      apiKey: "baileys",
      accountId: "acct-xyz",
    });
    const result = await provider.sendMessage({
      phone: "0812-3456-7890",
      message: "test",
    });

    expect(result.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "6281234567890@s.whatsapp.net",
      {
        text: "test",
      },
    );
  });
});
