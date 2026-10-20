import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  hasActiveScopeConsumers: vi.fn().mockResolvedValue(true),
  checkAllMikroTikRouterStatus: vi.fn(),
  getStatistics: vi.fn(),
  findActiveTenants: vi.fn(),
  retryVpnCoreRouterDeletes: vi.fn(),
  retryStaleVpnScripts: vi.fn(),
  refreshVpnServerStatuses: vi.fn(),
}));

vi.mock("@/modules/network/services/VpnServerStatusRefresh", () => ({
  refreshVpnServerStatuses: mockFns.refreshVpnServerStatuses,
}));

vi.mock("@/modules/network/services/VpnRouterScriptRetry", () => ({
  retryStaleVpnScripts: mockFns.retryStaleVpnScripts,
}));

vi.mock("@/modules/network/services/VpnCoreRouterCleanup", () => ({
  retryVpnCoreRouterDeletes: mockFns.retryVpnCoreRouterDeletes,
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: <T>(_reason: string, callback: () => Promise<T>) =>
    callback(),
  runWithRequestTenantContext: <T>(_ctx: unknown, callback: () => Promise<T>) =>
    callback(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
    hasActiveScopeConsumers: mockFns.hasActiveScopeConsumers,
  },
}));

vi.mock("@/modules/network/services/mikrotik-ping-check", () => ({
  checkAllMikroTikRouterStatus: mockFns.checkAllMikroTikRouterStatus,
}));

vi.mock("@/modules/network/repositories/MikroTikRouterRepository", () => ({
  MikroTikRouterRepository: class {
    getStatistics = mockFns.getStatistics;
  },
}));

vi.mock("@/modules/network/repositories/NetworkRepository", () => ({
  NetworkRepository: class {
    findActiveTenants = mockFns.findActiveTenants;
  },
}));

describe("MikroTikMonitor realtime publishing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFns.hasActiveScopeConsumers.mockResolvedValue(true);
    mockFns.checkAllMikroTikRouterStatus.mockResolvedValue(4);
    mockFns.findActiveTenants.mockResolvedValue([{ id: "tenant-1" }]);
    mockFns.getStatistics.mockResolvedValue({ onlineRouters: 3 });
    mockFns.retryVpnCoreRouterDeletes.mockResolvedValue(undefined);
    mockFns.retryStaleVpnScripts.mockResolvedValue(undefined);
    mockFns.refreshVpnServerStatuses.mockResolvedValue(undefined);
  });

  it("publishes mikrotik updates even when no admin consumer records are present", async () => {
    mockFns.hasActiveScopeConsumers.mockResolvedValue(false);

    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await mikroTikMonitor["checkStatus"]();

    expect(mockFns.hasActiveScopeConsumers).not.toHaveBeenCalled();
    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "mikrotik.update",
      scope: { kind: "admin", id: "mikrotik" },
      payload: { onlineRouters: 3 },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "mikrotik.update",
      scope: { kind: "admin", id: "mikrotik" },
      payload: {
        timestamp: expect.any(Date),
        updatedCount: 4,
      },
    });
  });

  it("publishes tenant stats and the global update event through Firebase", async () => {
    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await mikroTikMonitor["checkStatus"]();

    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "mikrotik.update",
      scope: { kind: "admin", id: "mikrotik" },
      payload: { onlineRouters: 3 },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "mikrotik.update",
      scope: { kind: "admin", id: "mikrotik" },
      payload: {
        timestamp: expect.any(Date),
        updatedCount: 4,
      },
    });
  });

  it("menjalankan retry hapus router core setelah status check, dan error-nya tidak menghentikan siklus", async () => {
    mockFns.retryVpnCoreRouterDeletes.mockRejectedValue(new Error("core down"));
    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await expect(mikroTikMonitor["checkStatus"]()).resolves.toBeUndefined();
    mikroTikMonitor.stop();

    expect(mockFns.checkAllMikroTikRouterStatus).toHaveBeenCalledTimes(1);
    expect(
      mockFns.checkAllMikroTikRouterStatus.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockFns.retryVpnCoreRouterDeletes.mock.invocationCallOrder[0],
    );
  });

  it("mengirim ulang skrip switch VPN setelah status check, dan error-nya tidak menghentikan siklus", async () => {
    mockFns.retryStaleVpnScripts.mockRejectedValue(new Error("db down"));
    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await expect(mikroTikMonitor["checkStatus"]()).resolves.toBeUndefined();
    mikroTikMonitor.stop();

    expect(mockFns.retryStaleVpnScripts).toHaveBeenCalledTimes(1);
    expect(
      mockFns.checkAllMikroTikRouterStatus.mock.invocationCallOrder[0],
    ).toBeLessThan(mockFns.retryStaleVpnScripts.mock.invocationCallOrder[0]);
  });

  it("menyegarkan status server VPN sekali per siklus; galatnya tidak menghentikan siklus", async () => {
    mockFns.refreshVpnServerStatuses.mockRejectedValue(
      new Error("core timeout"),
    );
    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await expect(mikroTikMonitor["checkStatus"]()).resolves.toBeUndefined();
    mikroTikMonitor.stop();

    expect(mockFns.refreshVpnServerStatuses).toHaveBeenCalledTimes(1);
    expect(mockFns.retryVpnCoreRouterDeletes).toHaveBeenCalledTimes(1);
    expect(mockFns.retryStaleVpnScripts).toHaveBeenCalledTimes(1);
  });
});
