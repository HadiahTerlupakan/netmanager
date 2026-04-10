import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  hasActiveScopeConsumers: vi.fn().mockResolvedValue(true),
  getDashboardStats: vi.fn(),
  getRecentSessions: vi.fn(),
  findActiveTenants: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
    hasActiveScopeConsumers: mockFns.hasActiveScopeConsumers,
  },
}));

vi.mock("@/modules/network/repositories/RadiusRepository", () => ({
  RadiusRepository: class {
    getDashboardStats = mockFns.getDashboardStats;
    getRecentSessions = mockFns.getRecentSessions;
  },
}));

vi.mock("@/modules/network/repositories/NetworkRepository", () => ({
  NetworkRepository: class {
    findActiveTenants = mockFns.findActiveTenants;
  },
}));

describe("RadiusMonitor realtime publishing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFns.hasActiveScopeConsumers.mockResolvedValue(true);
    mockFns.findActiveTenants.mockResolvedValue([{ id: "tenant-1" }]);
    mockFns.getDashboardStats.mockResolvedValue({ totalUsers: 12 });
    mockFns.getRecentSessions.mockResolvedValue({
      sessions: [{ username: "user-1" }],
      total: 1,
    });
  });

  it("skips radius publishes when the tenant scope has no active admin consumers", async () => {
    mockFns.hasActiveScopeConsumers.mockResolvedValue(false);

    const { RadiusMonitor } =
      await import("@/modules/network/services/RadiusMonitor");
    const monitor = new RadiusMonitor();

    await monitor["poll"]();

    expect(mockFns.hasActiveScopeConsumers).toHaveBeenCalledWith({
      kind: "admin",
      id: "radius:tenant-1",
    });
    expect(mockFns.publish).not.toHaveBeenCalled();
  });

  it("publishes radius stats and sessions to the tenant admin Firebase stream", async () => {
    const { RadiusMonitor } =
      await import("@/modules/network/services/RadiusMonitor");
    const monitor = new RadiusMonitor();

    await monitor["poll"]();

    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "radius.stats",
      scope: { kind: "admin", id: "radius:tenant-1" },
      payload: { totalUsers: 12 },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "radius.sessions",
      scope: { kind: "admin", id: "radius:tenant-1" },
      payload: { sessions: [{ username: "user-1" }], total: 1 },
    });
  });
});
