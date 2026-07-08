import { describe, expect, it } from "vitest";
import type {
  WhatsAppAccount,
  WhatsAppAccountUpdateInput,
} from "@/modules/notification/domain/whatsapp-account.entity";
import { WhatsAppAccountRepository } from "@/modules/notification/repositories/whatsapp-account.repository";
import { WhatsAppAccountService } from "@/modules/notification/services/whatsapp-account.service";

const baseAccount: WhatsAppAccount = {
  id: "wa-1",
  name: "Tenant One Account",
  phone: "628111111111",
  provider: "FONNTE",
  apiKey: "encrypted-key",
  domain: null,
  deviceId: null,
  accountType: "CUSTOMER",
  isActive: true,
  isDefault: false,
  priority: 10,
  dailyLimit: null,
  dailyCount: 0,
  lastReset: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  tenantId: "tenant-1",
};

class FakeWhatsAppAccountRepository extends WhatsAppAccountRepository {
  updateCalls = 0;
  deleteCalls = 0;
  setDefaultCalls = 0;

  constructor(private readonly account: WhatsAppAccount | null) {
    super();
  }

  override async findById(): Promise<WhatsAppAccount | null> {
    return this.account;
  }

  override async findByPhone(): Promise<WhatsAppAccount | null> {
    return null;
  }

  override async update(
    _id: string,
    data: WhatsAppAccountUpdateInput,
  ): Promise<WhatsAppAccount> {
    this.updateCalls += 1;
    return { ...baseAccount, ...data };
  }

  override async delete(): Promise<void> {
    this.deleteCalls += 1;
  }

  override async setDefault(): Promise<void> {
    this.setDefaultCalls += 1;
  }
}

describe("WhatsAppAccountService tenant ownership", () => {
  it("Given account tenant berbeda When find by id Then hasil null", async () => {
    const service = new WhatsAppAccountService(
      new FakeWhatsAppAccountRepository(baseAccount),
    );

    const account = await service.findById("wa-1", "tenant-2");

    expect(account).toBeNull();
  });

  it("Given account tenant sama When find by id Then account dikembalikan", async () => {
    const service = new WhatsAppAccountService(
      new FakeWhatsAppAccountRepository(baseAccount),
    );

    const account = await service.findById("wa-1", "tenant-1");

    expect(account?.id).toBe("wa-1");
  });

  it("Given account tenant berbeda When update Then update repository tidak dipanggil", async () => {
    const repository = new FakeWhatsAppAccountRepository(baseAccount);
    const service = new WhatsAppAccountService(repository);

    const result = await service.update(
      "wa-1",
      { name: "Cross Tenant" },
      "tenant-2",
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Akun tidak ditemukan");
    expect(repository.updateCalls).toBe(0);
  });

  it("Given account tenant berbeda When delete Then delete repository tidak dipanggil", async () => {
    const repository = new FakeWhatsAppAccountRepository(baseAccount);
    const service = new WhatsAppAccountService(repository);

    const result = await service.delete("wa-1", "tenant-2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Akun tidak ditemukan");
    expect(repository.deleteCalls).toBe(0);
  });

  it("Given account tenant berbeda When set default Then setDefault repository tidak dipanggil", async () => {
    const repository = new FakeWhatsAppAccountRepository(baseAccount);
    const service = new WhatsAppAccountService(repository);

    const result = await service.setDefault("wa-1", "tenant-2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Akun tidak ditemukan");
    expect(repository.setDefaultCalls).toBe(0);
  });

  it("Given account tenant sama When update Then update repository dipanggil", async () => {
    const repository = new FakeWhatsAppAccountRepository(baseAccount);
    const service = new WhatsAppAccountService(repository);

    const result = await service.update(
      "wa-1",
      { name: "Updated" },
      "tenant-1",
    );

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Updated");
    expect(repository.updateCalls).toBe(1);
  });
});
