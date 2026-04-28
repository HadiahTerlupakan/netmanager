import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  hasActiveScopeConsumers: vi.fn().mockResolvedValue(true),
  checkAllMikroTikRouterStatus: vi.fn(),
  getStatistics: vi.fn(),
  findActiveTenants: vi.fn(),
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
});
