import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  setActiveServer: vi.fn(),
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
vi.mock("@/modules/network/repositories/MikroTikRouterVpnRepository", () => ({
  MikroTikRouterVpnRepository: class {
    setActiveServer = mocks.setActiveServer;
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

function activeServerOf(routerId: string): string | null | undefined {
  const call = mocks.setActiveServer.mock.calls.find(([id]) => id === routerId);
  return call?.[2];
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
    mocks.setActiveServer.mockResolvedValue(undefined);
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

  it("asks core for the active server of an online VPN router and saves it", async () => {
    const online = router("a");
    mocks.reachableHosts.add(online.ipAddress);
    mocks.findAll.mockResolvedValue([
      online,
      router("bb", { connectionMode: "PUBLIC", vpnCoreRouterId: null }),
    ]);
    mocks.getRouter.mockResolvedValue({
      lastHandshakeAt: STALE_HANDSHAKE,
      activeHubId: "s2",
    });

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("online");
    expect(activeServerOf("a")).toBe("s2");
    expect(mocks.setActiveServer).toHaveBeenCalledWith("a", "t1", "s2");
    expect(statusOf("bb")).toBe("offline");
    expect(mocks.getRouter).toHaveBeenCalledTimes(1);
    expect(activeServerOf("bb")).toBeUndefined();
    expect(
      mocks.update.mock.calls.find(([id]) => id === "a")?.[1],
    ).not.toHaveProperty("vpnActiveServerId");
  });

  it("saves the active server of a failed VPN router next to its status", async () => {
    mocks.findAll.mockResolvedValue([router("a")]);
    mocks.getRouter.mockResolvedValue({
      lastHandshakeAt: FRESH_HANDSHAKE,
      activeHubId: "s1",
    });

    await checkAllMikroTikRouterStatus();

    expect(statusOf("a")).toBe("offline");
    expect(activeServerOf("a")).toBe("s1");
  });

  it("does not write the active server of an online router once the breaker tripped", async () => {
    const first = router("a");
    const second = router("bb");
    mocks.reachableHosts.add(second.ipAddress);
    mocks.findActiveTenants.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    mocks.findAll
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second]);
    mocks.getRouter.mockRejectedValue(new Error("core down"));

    await checkAllMikroTikRouterStatus();

    expect(statusOf("bb")).toBe("online");
    expect(activeServerOf("bb")).toBeUndefined();
    expect(mocks.getRouter).toHaveBeenCalledTimes(1);
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

  it("caps in-flight core lookups at 20 without making a public router wait", async () => {
    const routers = Array.from({ length: 25 }, (_, i) =>
      router(`v${i}`, { ipAddress: `10.100.1.${i}` }),
    );
    const publicRouter = router("pub", {
      connectionMode: "PUBLIC",
      vpnCoreRouterId: null,
    });
    mocks.findAll.mockResolvedValue([...routers, publicRouter]);
    const held: Array<() => void> = [];
    let inFlight = 0;
    let peak = 0;
    mocks.getRouter.mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          held.push(() => {
            inFlight -= 1;
            resolve({ lastHandshakeAt: FRESH_HANDSHAKE, activeHubId: "s1" });
          });
        }),
    );

    const cycle = checkAllMikroTikRouterStatus();
    await vi.waitFor(() => expect(mocks.getRouter).toHaveBeenCalledTimes(20));
    await vi.waitFor(() => expect(statusOf("pub")).toBe("offline"));
    expect(peak).toBe(20);

    while (held.length > 0 || mocks.getRouter.mock.calls.length < 25) {
      held.splice(0).forEach((release) => release());
      await new Promise((resolve) => setImmediate(resolve));
    }
    await cycle;
    expect(peak).toBe(20);
    expect(mocks.getRouter).toHaveBeenCalledTimes(25);
  });

  it("applies tunnel_down to a single-router check too", async () => {
    mocks.findRouterTenantId.mockResolvedValue({ tenantId: "t1" });
    mocks.findById.mockResolvedValue(router("a"));
    mocks.getRouter.mockResolvedValue({ lastHandshakeAt: STALE_HANDSHAKE });

    await expect(checkSingleMikroTikRouterStatus("a")).resolves.toBe(false);
    expect(statusOf("a")).toBe("tunnel_down");
  });
});
