import { beforeEach, describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "../../setup";
import { PaymentGatewayConfigRepository } from "@/modules/payment-gateway/repositories/PaymentGatewayConfigRepository";

// Model ini tidak terdaftar di tipe MockPrismaClient, tetapi proxy-nya ada.
const configs = (
  prismaMock as unknown as {
    paymentGatewayConfig: { findFirst: Mock; findMany: Mock };
  }
).paymentGatewayConfig;

const row = (tenantId: string) => ({
  id: `cfg-${tenantId}`,
  provider: "DUITKU",
  apiKey: "enc",
  apiSecret: null as string | null,
  clientKey: null as string | null,
  merchantId: "D1",
  isProduction: false,
  isEnabled: true,
  isRevoked: false,
  priority: 0,
  settings: null as unknown,
  tenantId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const repository = new PaymentGatewayConfigRepository();

/**
 * Konfigurasi gateway dulu dicari dengan findFirst tanpa tenant bila tenant
 * tidak diketahui: callback bisa diverifikasi dengan kunci tenant mana pun,
 * termasuk konfigurasi yang sudah dimatikan.
 */
describe("PaymentGatewayConfigRepository.findByProvider", () => {
  beforeEach(() => {
    configs.findMany.mockResolvedValue([]);
  });

  it("dengan tenant: konfigurasi tenant itu, apa pun statusnya", async () => {
    configs.findFirst.mockResolvedValue(row("tenant-a"));

    await expect(
      repository.findByProvider("DUITKU", "tenant-a"),
    ).resolves.toMatchObject({ tenantId: "tenant-a" });
    expect(configs.findFirst).toHaveBeenCalledWith({
      where: { provider: "DUITKU", tenantId: "tenant-a" },
    });
  });

  it("tanpa tenant: hanya konfigurasi aktif yang tidak dicabut", async () => {
    configs.findMany.mockResolvedValue([row("tenant-a")]);

    await expect(repository.findByProvider("DUITKU")).resolves.toMatchObject({
      tenantId: "tenant-a",
    });
    expect(configs.findMany).toHaveBeenCalledWith({
      where: { provider: "DUITKU", isEnabled: true, isRevoked: false },
      take: 2,
    });
    expect(configs.findFirst).not.toHaveBeenCalled();
  });

  it("tanpa tenant dan lebih dari satu konfigurasi aktif: ditolak", async () => {
    configs.findMany.mockResolvedValue([row("tenant-a"), row("tenant-b")]);

    await expect(repository.findByProvider("DUITKU")).rejects.toThrow(
      /lebih dari satu tenant/,
    );
  });

  it("konfigurasi yang dicabut tidak ikut daftar konfigurasi aktif", async () => {
    await repository.findEnabled("tenant-a");

    expect(configs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isEnabled: true, isRevoked: false, tenantId: "tenant-a" },
      }),
    );
  });
});
