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

vi.mock("@/modules/network", () => ({
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

  it("skips mikrotik publishes when the admin mikrotik scope has no active consumers", async () => {
    mockFns.hasActiveScopeConsumers.mockResolvedValue(false);

    const { mikroTikMonitor } =
      await import("@/modules/network/services/MikroTikMonitor");

    await mikroTikMonitor["checkStatus"]();

    expect(mockFns.hasActiveScopeConsumers).toHaveBeenCalledWith({
      kind: "admin",
      id: "mikrotik",
    });
    expect(mockFns.publish).not.toHaveBeenCalled();
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
