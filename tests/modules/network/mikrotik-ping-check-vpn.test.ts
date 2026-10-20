import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  findActiveTenants: vi.fn(),
  findRouterTenantId: vi.fn(),
  getRouter: vi.fn(),
  isVpnConfigured: vi.fn(),
  reachableHosts: new Set<string>(),
}));

vi.mock("node-routeros-v2", () => ({
  RouterOSAPI: class {
    constructor(private readonly options: { host: string }) {}
    connect() {
      return mocks.reachableHosts.has(this.options.host)
        ? Promise.resolve()
        : Promise.reject(new Error("ETIMEDOUT"));
    }
    write() {
      return Promise.resolve([{}, {}]);
    }
    close() {}
  },
}));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: <T>(_reason: string, callback: () => Promise<T>) =>
    callback(),
  runWithRequestTenantContext: <T>(_ctx: unknown, callback: () => Promise<T>) =>
    callback(),
}));
vi.mock("@/modules/network/repositories/MikroTikRouterRepository", () => ({
  MikroTikRouterRepository: class {
    findAll = mocks.findAll;
    findById = mocks.findById;
    update = mocks.update;
  },
}));
vi.mock("@/modules/network/repositories/NetworkRepository", () => ({
  NetworkRepository: class {
    findActiveTenants = mocks.findActiveTenants;
    findRouterTenantId = mocks.findRouterTenantId;
  },
}));
vi.mock("@/modules/network/vpn/VpnCoreClient", () => ({
  getVpnCoreClient: () => ({ getRouter: mocks.getRouter }),
  isVpnConfigured: mocks.isVpnConfigured,
}));

import {
  checkAllMikroTikRouterStatus,
  checkSingleMikroTikRouterStatus,
} from "@/modules/network/services/mikrotik-ping-check";

const NOW = Date.parse("2026-10-20T10:00:00.000Z");
const STALE_HANDSHAKE = "2026-10-20T09:56:00.000Z";
const FRESH_HANDSHAKE = "2026-10-20T09:59:00.000Z";

function router(id: string, overrides: object = {}) {
  return {
    id,
    ipAddress: `10.100.0.${id.length}`,
    apiPort: 8728,
    apiUsername: "admin",
    apiPassword: "secret",
    apiUsernameGenerated: null as string | null,
    apiPasswordGenerated: null as string | null,
    connectionMode: "VPN",
    vpnCoreRouterId: `core-${id}`,
    ...overrides,
  };
}

function statusOf(routerId: string): string | undefined {
  const call = mocks.update.mock.calls.find(([id]) => id === routerId);
  return call?.[1].pingStatus;
}

describe("mikrotik ping-check for VPN routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.reachableHosts.clear();
    mocks.isVpnConfigured.mockReturnValue(true);
    mocks.findActiveTenants.mockResolvedValue([{ id: "t1" }]);
    mocks.update.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("marks a failed VPN router tunnel_down when the core handshake is stale", async () => {
    mocks.findAll.mockResolvedValue([router("a"), router("bb")]);
    mocks.getRouter.mockImplementation(async (id: string) => ({
      lastHandshakeAt: id === "core-a" ? STALE_HANDSHAKE : FRESH_HANDSHAKE,
    }));

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("tunnel_down");
    expect(statusOf("bb")).toBe("offline");
  });

  it("treats a router that never handshook as tunnel_down", async () => {
    mocks.findAll.mockResolvedValue([router("a")]);
    mocks.getRouter.mockResolvedValue({ lastHandshakeAt: null });

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("tunnel_down");
  });

  it("asks core only for VPN routers whose API check failed", async () => {
    const online = router("a");
    mocks.reachableHosts.add(online.ipAddress);
    mocks.findAll.mockResolvedValue([
      online,
      router("bb", { connectionMode: "PUBLIC", vpnCoreRouterId: null }),
    ]);

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("online");
    expect(statusOf("bb")).toBe("offline");
    expect(mocks.getRouter).not.toHaveBeenCalled();
  });

  it("falls back to offline and stops asking core after the first core error", async () => {
    mocks.findActiveTenants.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    mocks.findAll
      .mockResolvedValueOnce([router("a")])
      .mockResolvedValueOnce([router("bb")]);
    mocks.getRouter.mockRejectedValue(new Error("core down"));

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("offline");
    expect(statusOf("bb")).toBe("offline");
    expect(mocks.getRouter).toHaveBeenCalledTimes(1);
  });

  it("stays offline without asking core when VPN is not configured", async () => {
    mocks.isVpnConfigured.mockReturnValue(false);
    mocks.findAll.mockResolvedValue([router("a")]);

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("offline");
    expect(mocks.getRouter).not.toHaveBeenCalled();
  });

  it("applies tunnel_down to a single-router check too", async () => {
    mocks.findRouterTenantId.mockResolvedValue({ tenantId: "t1" });
    mocks.findById.mockResolvedValue(router("a"));
    mocks.getRouter.mockResolvedValue({ lastHandshakeAt: STALE_HANDSHAKE });

    await expect(checkSingleMikroTikRouterStatus("a")).resolves.toBe(false);
    expect(statusOf("a")).toBe("tunnel_down");
  });
});
