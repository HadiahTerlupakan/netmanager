import { describe, expect, it, vi } from "vitest";

const mockConnect = vi.hoisted(() => vi.fn());
const mockDisconnectSession = vi.hoisted(() => vi.fn());
const mockDebugActiveSessionUsage = vi.hoisted(() => vi.fn());
const mockFindRouterTenantId = vi.hoisted(() => vi.fn());
const mockFindPelangganWithRouter = vi.hoisted(() => vi.fn());
const mockFindRouterById = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/network/services/mikrotik/MikroTikConnectionFactory",
  () => ({
    MikroTikConnectionFactory: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
    })),
  }),
);

vi.mock("@/modules/network/services/mikrotik/MikroTikSessionService", () => ({
  MikroTikSessionService: vi.fn().mockImplementation(() => ({
    disconnectSession: mockDisconnectSession,
    debugActiveSessionUsage: mockDebugActiveSessionUsage,
  })),
}));

import { MikroTikPPPSecretService } from "@/modules/network/services/MikroTikPPPSecretService";

function buildDeps() {
  return {
    networkRepository: {
      findRouterTenantId: mockFindRouterTenantId,
      findPelangganWithRouter: mockFindPelangganWithRouter,
    },
    routerRepository: {
      findById: mockFindRouterById,
    },
    connectionFactory: {
      connect: mockConnect,
    },
    sessionService: {
      disconnectSession: mockDisconnectSession,
      debugActiveSessionUsage: mockDebugActiveSessionUsage,
    },
  } as const;
}

describe("MikroTikPPPSecretService contract", () => {
  it("exposes the existing public API", () => {
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    expect(typeof service.createSecret).toBe("function");
    expect(typeof service.setSecretProfile).toBe("function");
    expect(typeof service.disconnectSession).toBe("function");
    expect(typeof service.getActiveSessionUsage).toBe("function");
    expect(typeof service.debugActiveSessionUsage).toBe("function");
    expect(typeof service.deleteSecret).toBe("function");
    expect(typeof service.isolateCustomer).toBe("function");
    expect(typeof service.unIsolateCustomer).toBe("function");
    expect(typeof service.dismantleCustomer).toBe("function");
    expect(typeof service.syncNewCustomer).toBe("function");
  });

  it("keeps the dependency guard error message", () => {
    expect(() => new MikroTikPPPSecretService()).toThrow(
      "MikroTik PPP Secret dependencies wajib disediakan",
    );
  });

  it("returns router not found shape for createSecret when router context is missing", async () => {
    mockFindRouterTenantId.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.createSecret("router-1", {
      name: "user-1",
      password: "secret",
      profile: "basic",
    });

    expect(result).toEqual({ success: false, error: "Router tidak ditemukan" });
  });

  it("returns router not found shape for setSecretProfile when router context is missing", async () => {
    mockFindRouterTenantId.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.setSecretProfile(
      "router-1",
      "user-1",
      "basic",
    );

    expect(result).toEqual({ success: false, error: "Router tidak ditemukan" });
  });

  it("returns router not found shape for disconnectSession when router context is missing", async () => {
    mockFindRouterTenantId.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.disconnectSession("router-1", "user-1");

    expect(result).toEqual({
      success: false,
      disconnected: 0,
      error: "Router tidak ditemukan",
    });
  });

  it("returns router not found shape for isolateCustomer when pelanggan router context is missing", async () => {
    mockFindPelangganWithRouter.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.isolateCustomer("pelanggan-1");

    expect(result).toEqual({
      success: false,
      logs: [],
      error: "Pelanggan atau router tidak ditemukan",
    });
  });

  it("returns router not found shape for unIsolateCustomer when pelanggan router context is missing", async () => {
    mockFindPelangganWithRouter.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.unIsolateCustomer("pelanggan-1");

    expect(result).toEqual({
      success: false,
      logs: [],
      error: "Pelanggan atau router tidak ditemukan",
    });
  });

  it("returns router not found shape for dismantleCustomer when pelanggan router context is missing", async () => {
    mockFindPelangganWithRouter.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.dismantleCustomer("pelanggan-1");

    expect(result).toEqual({
      success: false,
      logs: [],
      error: "Pelanggan atau router tidak ditemukan",
    });
  });

  it("returns router not found shape for syncNewCustomer when pelanggan router context is missing", async () => {
    mockFindPelangganWithRouter.mockResolvedValueOnce(null);
    const service = new MikroTikPPPSecretService(
      buildDeps() as unknown as ConstructorParameters<
        typeof MikroTikPPPSecretService
      >[0],
    );

    const result = await service.syncNewCustomer("pelanggan-1");

    expect(result).toEqual({
      success: false,
      logs: [],
      error: "Pelanggan atau router tidak ditemukan",
    });
  });
});
