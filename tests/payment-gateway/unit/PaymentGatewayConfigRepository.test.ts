import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "../../setup";
import { PaymentGatewayConfigRepository } from "@/modules/payment-gateway/repositories/PaymentGatewayConfigRepository";

// Model ini tidak terdaftar di tipe MockPrismaClient, tetapi proxy-nya ada.
const configs = (
  prismaMock as unknown as {
    paymentGatewayConfig: {
      findFirst: Mock;
      findMany: Mock;
      updateManyAndReturn: Mock;
    };
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

// Sakelar darurat dari halaman pengaturan admin: hanya konfigurasi tenant
// admin itu yang berubah, dan isEnabled-nya tidak disentuh.
describe("PaymentGatewayConfigRepository.setRevoked", () => {
  it("mencabut konfigurasi provider milik tenant itu saja", async () => {
    configs.updateManyAndReturn = vi
      .fn()
      .mockResolvedValue([
        { id: "cfg-tenant-a", provider: "DUITKU", isRevoked: true },
      ]);

    await expect(
      repository.setRevoked("DUITKU", "tenant-a", true),
    ).resolves.toEqual({
      id: "cfg-tenant-a",
      provider: "DUITKU",
      isRevoked: true,
    });
    expect(configs.updateManyAndReturn).toHaveBeenCalledWith({
      where: { provider: "DUITKU", tenantId: "tenant-a" },
      data: { isRevoked: true, updatedAt: expect.any(Date) },
      select: { id: true, provider: true, isRevoked: true },
    });
  });

  it("tenant tanpa konfigurasi provider itu: null", async () => {
    configs.updateManyAndReturn = vi.fn().mockResolvedValue([]);

    await expect(
      repository.setRevoked("TRIPAY", "tenant-a", false),
    ).resolves.toBeNull();
  });
});
