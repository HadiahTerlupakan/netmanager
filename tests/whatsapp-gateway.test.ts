import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppAccount } from "../modules/notification/domain/whatsapp-account.entity";
import { WhatsAppAccountRepository } from "../modules/notification/repositories/whatsapp-account.repository";
import { WhatsAppMessageRepository } from "../modules/notification/repositories/whatsapp-message.repository";
import type { WhatsAppMessage } from "../modules/notification/domain/whatsapp-message.entity";
import type { SendResult } from "../modules/notification/services/whatsapp/whatsapp-provider-interface";

const mocks = vi.hoisted(() => ({
  decryptApiKey: vi.fn((value: string) => value),
  createProvider: vi.fn(),
  resetDailyCount: vi.fn(),
  incrementDailyCount: vi.fn(),
  createMessage: vi.fn(),
  updateStatus: vi.fn(),
  throttlerAdd: vi.fn(<T>(task: () => Promise<T>) => task()),
}));

vi.mock("@/lib/utils/encryption", () => ({
  decryptApiKey: mocks.decryptApiKey,
}));

vi.mock("../modules/notification/services/whatsapp/whatsapp-factory", () => ({
  WhatsAppFactory: {
    createProvider: mocks.createProvider,
  },
}));

vi.mock("../modules/notification/services/whatsapp/whatsapp-throttler", () => ({
  whatsAppThrottler: {
    add: mocks.throttlerAdd,
  },
}));

const baseAccount: WhatsAppAccount = {
  id: "wa-1",
  name: "Primary",
  phone: "628111111111",
  provider: "FONNTE",
  apiKey: "encrypted-key",
  domain: null,
  deviceId: null,
  accountType: "CUSTOMER",
  isActive: true,
  isDefault: true,
  priority: 10,
  dailyLimit: 1,
  dailyCount: 1,
  lastReset: new Date(Date.now() - 25 * 60 * 60 * 1000),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  tenantId: "tenant-1",
};

class FakeAccountRepository extends WhatsAppAccountRepository {
  constructor(private readonly account: WhatsAppAccount) {
    super();
  }

  override async findById(): Promise<WhatsAppAccount | null> {
    return this.account;
  }

  override async findDefault(): Promise<WhatsAppAccount | null> {
    return this.account;
  }

  override async findAvailable(): Promise<WhatsAppAccount[]> {
    return [this.account];
  }

  override async findDefaultByAccountType(): Promise<WhatsAppAccount | null> {
    return this.account;
  }

  override async findByAccountType(): Promise<WhatsAppAccount[]> {
    return [this.account];
  }

  override async incrementDailyCount(id: string): Promise<void> {
    await mocks.incrementDailyCount(id);
  }

  override async resetDailyCount(id: string): Promise<void> {
    await mocks.resetDailyCount(id);
  }
}

class FakeMessageRepository extends WhatsAppMessageRepository {
  override async create(): Promise<WhatsAppMessage> {
    await mocks.createMessage();
    return { id: "msg-1" } as WhatsAppMessage;
  }

  override async updateStatus(
    ...args: readonly unknown[]
  ): Promise<WhatsAppMessage> {
    await mocks.updateStatus(...args);
    return { id: "msg-1" } as WhatsAppMessage;
  }

  override async findRecent(): Promise<WhatsAppMessage[]> {
    return [];
  }

  override async getStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    return { total: 0, sent: 0, failed: 0, pending: 0 };
  }
}

describe("WhatsApp gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decryptApiKey.mockImplementation((value: string) => value);
    mocks.throttlerAdd.mockImplementation(<T>(task: () => Promise<T>) =>
      task(),
    );
    mocks.createMessage.mockResolvedValue(undefined);
    mocks.updateStatus.mockResolvedValue(undefined);
    mocks.incrementDailyCount.mockResolvedValue(undefined);
    mocks.resetDailyCount.mockResolvedValue(undefined);
  });

  it("Given account melewati reset 24 jam When send Then daily limit tidak memblokir pengiriman", async () => {
    const { WhatsAppSenderService } =
      await import("../modules/notification/services/whatsapp-sender.service");
    mocks.createProvider.mockReturnValue({
      name: "Fake",
      sendMessage: vi.fn<() => Promise<SendResult>>().mockResolvedValue({
        success: true,
        messageId: "provider-msg-1",
      }),
    });

    const service = new WhatsAppSenderService(
      new FakeAccountRepository(baseAccount),
      new FakeMessageRepository(),
    );

    const result = await service.send({
      phone: "0812-3456-7890",
      message: "Halo",
      tenantId: "tenant-1",
    });

    expect(result.success).toBe(true);
    expect(mocks.resetDailyCount).toHaveBeenCalledWith("wa-1");
    expect(mocks.incrementDailyCount).toHaveBeenCalledWith("wa-1");
  });

  it("Given provider tanpa sendFile When send file Then pesan gagal tersimpan tanpa runtime crash", async () => {
    const { WhatsAppSenderService } =
      await import("../modules/notification/services/whatsapp-sender.service");
    mocks.createProvider.mockReturnValue({
      name: "TextOnly",
      sendMessage: vi.fn(),
    });

    const service = new WhatsAppSenderService(
      new FakeAccountRepository({ ...baseAccount, dailyCount: 0 }),
      new FakeMessageRepository(),
    );

    const result = await service.send({
      phone: "+62812 3456 7890",
      message: "Invoice",
      fileUrl: "https://example.test/invoice.pdf",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("tidak mendukung pengiriman file");
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      "msg-1",
      "failed",
      expect.stringContaining("tidak mendukung pengiriman file"),
    );
  });

  it("Given nomor lokal When provider Fonnte send Then nomor dinormalisasi ke 628", async () => {
    const { FonnteProvider } =
      await import("../modules/notification/services/whatsapp/providers/fonnte-provider");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "send", id: "fonnte-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FonnteProvider({ provider: "FONNTE", apiKey: "key" });
    const result = await provider.sendMessage({
      phone: "0812-3456-7890",
      message: "Halo",
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(result.success).toBe(true);
    expect(request.target).toBe("6281234567890");
  });

  it("Given gateway balas HTML When provider Wablas send Then error memuat status dan preview response", async () => {
    const { WablasProvider } =
      await import("../modules/notification/services/whatsapp/providers/wablas-provider");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("<html>bad gateway</html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const provider = new WablasProvider({
      provider: "WABLAS",
      apiKey: "key",
      domain: "wablas.example.test",
    });
    const result = await provider.sendMessage({
      phone: "+62812 3456 7890",
      message: "Halo",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("status 502");
    expect(result.error).toContain("bad gateway");
  });

  it("Given Wablas send When request built Then uses Authorization header and phone field", async () => {
    const { WablasProvider } =
      await import("../modules/notification/services/whatsapp/providers/wablas-provider");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: true, data: { id: "msg-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WablasProvider({
      provider: "WABLAS",
      apiKey: "token.secret",
      domain: "kudus.wablas.com",
      deviceId: "device-1",
    });
    const result = await provider.sendMessage({
      phone: "+62812 3456 7890",
      message: "Halo",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://kudus.wablas.com/api/send-message");
    expect(String(url)).not.toContain("token=");
    expect(init?.headers).toMatchObject({ Authorization: "token.secret" });
    const body = init?.body as URLSearchParams;
    expect(body.get("phone")).toBe("6281234567890");
    expect(body.get("message")).toBe("Halo");
    expect(body.get("sender")).toBe("device-1");
    expect(body.get("number")).toBeNull();
  });
});
