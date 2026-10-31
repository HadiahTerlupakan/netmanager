import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { prismaMock } from "../../setup";
import { isSandboxGatewayLive } from "@/modules/payment-gateway/services/sandbox-gateway-warning";

/**
 * Produksi sengaja memakai Duitku SANDBOX untuk sementara; halaman demo
 * sandbox Duitku bisa "membayar" VA mana pun. Itu harus selalu terlihat.
 */
// Model ini tidak terdaftar di tipe MockPrismaClient, tetapi proxy-nya ada.
const configs = (
  prismaMock as unknown as { paymentGatewayConfig: { count: Mock } }
).paymentGatewayConfig;

describe("peringatan gateway sandbox di produksi", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    configs.count.mockResolvedValue(1);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("menyala bila Duitku aktif tenant ini memakai sandbox", async () => {
    await expect(isSandboxGatewayLive("tenant-1")).resolves.toBe(true);
    expect(configs.count).toHaveBeenCalledWith({
      where: {
        provider: "DUITKU",
        isEnabled: true,
        isProduction: false,
        tenantId: "tenant-1",
      },
    });
  });

  it("padam bila Duitku-nya produksi atau dimatikan", async () => {
    configs.count.mockResolvedValue(0);

    await expect(isSandboxGatewayLive("tenant-1")).resolves.toBe(false);
  });

  it("tanpa tenant (super admin, health check) memeriksa semua tenant", async () => {
    await isSandboxGatewayLive(null);

    expect(configs.count).toHaveBeenCalledWith({
      where: { provider: "DUITKU", isEnabled: true, isProduction: false },
    });
  });

  it("di luar produksi sandbox memang wajar dan tidak diperingatkan", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(isSandboxGatewayLive("tenant-1")).resolves.toBe(false);
    expect(configs.count).not.toHaveBeenCalled();
  });
});
