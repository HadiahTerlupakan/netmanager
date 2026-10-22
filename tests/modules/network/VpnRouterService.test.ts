import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const coreMock = vi.hoisted(() => ({
  getRouter: vi.fn(),
  setRouterHubs: vi.fn(),
  routerScript: vi.fn(),
  listHubs: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
}));

import { VpnRouterService } from "@/modules/network/services/VpnRouterService";
import { RouterNotFoundError } from "@/modules/network/services/mikrotik-router.access";
import {
  VpnCoreError,
  VpnRouterBusyError,
  VpnRouterInvalidError,
  VpnRouterUnreachableError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn";
import type {
  IMikroTikRouterVpnRepository,
  VpnRouterRecord,
} from "@/modules/network/domain/ports/IMikroTikRouterVpnRepository";
import type { CoreRouter } from "@/modules/network/vpn/types";

const TENANT = "t1";
const SWITCH_SCRIPT = ':local servers {"c.example.com|51820|key-c"}';

function vpnRouter(overrides: Partial<VpnRouterRecord> = {}): VpnRouterRecord {
  return {
    id: "router-1",
    connectionMode: "VPN",
    vpnCoreRouterId: "core-1",
    vpnActiveServerId: "a",
    vpnScriptStale: false,
    ipAddress: "10.100.0.10",
    apiPort: 8728,
    apiUsername: "netmanager-0011aabb",
    apiPassword: "secret",
    apiUsernameGenerated: null,
    apiPasswordGenerated: null,
    ...overrides,
  };
}

function coreRouter(overrides: Partial<CoreRouter> = {}): CoreRouter {
  return {
    id: "core-1",
    label: "nm:t1",
    ref: "router-1",
    address: "10.100.0.10",
    status: "active",
    hubs: [
      { hubId: "b", name: "B", priority: 1, syncState: "synced" },
      { hubId: "a", name: "A", priority: 0, syncState: "synced" },
    ],
    activeHubId: "a",
    lastHandshakeAt: "2026-10-20T10:00:00.000Z",
    events: [],
    ...overrides,
  };
}

const tenantServers = [
  { id: "a", name: "A", publicHost: "a.example.com", status: "online" },
  { id: "b", name: "B", publicHost: "b.example.com", status: "online" },
  { id: "c", name: "C", publicHost: "c.example.com", status: "online" },
  { id: "d", name: "D", publicHost: "d.example.com", status: "offline" },
];

function track(name: string) {
  return vi.fn(async (...args: unknown[]): Promise<void> => {
    calls.push(`${name} ${JSON.stringify(args)}`);
  });
}

const SERVER_NAMES: Record<string, string> = { a: "A", b: "B", c: "C" };

function makeService(router: VpnRouterRecord | null = vpnRouter()) {
  // Daftar server lokal yang bisa diganti request lain di tengah pengiriman.
  const stored = { ids: ["c", "a"] };
  // Kunci advisory per router: false meniru request lain yang memegangnya.
  const lock = { isFree: true };
  const holdLock: IMikroTikRouterVpnRepository["withServerListLock"] = async (
    routerId,
    fn,
  ) => {
    if (!lock.isFree) return { acquired: false };
    calls.push(`lock ${routerId}`);
    try {
      return { acquired: true, value: await fn() };
    } finally {
      calls.push(`unlock ${routerId}`);
    }
  };
  const repo = {
    findRouter: vi.fn().mockResolvedValue(router),
    listServers: vi.fn(async () => {
      calls.push("listServers");
      return stored.ids.map((id, priority) => ({
        id,
        name: SERVER_NAMES[id],
        priority,
      }));
    }),
    // vi.fn menghapus parameter generik; signature aslinya dipulihkan di sini.
    withServerListLock: vi.fn(holdLock) as Mock & typeof holdLock,
    replaceServersAsStale: vi.fn(
      async (routerId: string, tenantId: string, ids: string[]) => {
        calls.push(
          `replaceServersAsStale ${JSON.stringify([routerId, tenantId, ids])}`,
        );
        stored.ids = ids;
      },
    ),
    // Semantik compare-and-set repository: finalize hanya bila daftar sama.
    completeScriptSend: vi.fn(
      async (
        routerId: string,
        tenantId: string,
        sent: string[],
        finalize: () => Promise<void>,
      ) => {
        if (JSON.stringify(sent) !== JSON.stringify(stored.ids)) {
          calls.push(`scriptLeftStale ${JSON.stringify([routerId, tenantId])}`);
          return false;
        }
        await finalize();
        calls.push(`scriptSent ${JSON.stringify([routerId, tenantId])}`);
        return true;
      },
    ),
    setActiveServer: vi.fn().mockResolvedValue(undefined),
    findStaleOnline: vi.fn(),
  };
  const routerOs = {
    writeSwitchScript: track("writeSwitchScript"),
    writePeerEndpoint: vi.fn().mockResolvedValue(undefined),
  };
  const servers = { tenantServers: vi.fn().mockResolvedValue(tenantServers) };
  const service = new VpnRouterService(repo, servers, routerOs);
  return { service, repo, routerOs, stored, lock };
}

describe("VpnRouterService.updateServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    coreMock.getRouter.mockResolvedValue(coreRouter());
    coreMock.setRouterHubs.mockImplementation(async (...args: unknown[]) => {
      calls.push(`setRouterHubs ${JSON.stringify(args)}`);
      return coreRouter();
    });
    coreMock.routerScript.mockImplementation(async (...args: unknown[]) => {
      calls.push(`routerScript ${JSON.stringify(args)}`);
      return SWITCH_SCRIPT;
    });
  });

  it("keeps removed hubs at the tail until the switch script reaches the router", async () => {
    const { service } = makeService();

    const result = await service.updateServers("router-1", TENANT, ["c", "a"]);

    expect(result).toEqual({ scriptStale: false });
    expect(calls).toEqual([
      "lock router-1",
      'setRouterHubs ["core-1",["c","a","b"]]',
      'replaceServersAsStale ["router-1","t1",["c","a"]]',
      'routerScript ["core-1","switch"]',
      `writeSwitchScript [${JSON.stringify(vpnRouter())},${JSON.stringify(SWITCH_SCRIPT)}]`,
      'setRouterHubs ["core-1",["c","a"]]',
      'scriptSent ["router-1","t1"]',
      "unlock router-1",
    ]);
  });

  it("leaves the script stale and the tail in core when the router is unreachable", async () => {
    const { service, routerOs, repo } = makeService();
    routerOs.writeSwitchScript.mockRejectedValue(new Error("ETIMEDOUT"));

    const result = await service.updateServers("router-1", TENANT, ["c"]);

    expect(result).toEqual({ scriptStale: true });
    expect(coreMock.setRouterHubs).toHaveBeenCalledTimes(1);
    expect(coreMock.setRouterHubs).toHaveBeenCalledWith("core-1", [
      "c",
      "a",
      "b",
    ]);
    expect(repo.replaceServersAsStale).toHaveBeenCalledWith(
      "router-1",
      TENANT,
      ["c"],
    );
    expect(repo.completeScriptSend).not.toHaveBeenCalled();
  });

  it("a PUT that loses to a newer PUT answers stale without the final PUT", async () => {
    const { service, routerOs, stored } = makeService();
    routerOs.writeSwitchScript.mockImplementation(async () => {
      stored.ids = ["a"];
    });

    const result = await service.updateServers("router-1", TENANT, ["c", "a"]);

    expect(result).toEqual({ scriptStale: true });
    expect(coreMock.setRouterHubs).toHaveBeenCalledTimes(1);
  });

  it("rejects servers that are offline or not assigned before touching core", async () => {
    const { service } = makeService();

    await expect(
      service.updateServers("router-1", TENANT, ["a", "d"]),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    await expect(
      service.updateServers("router-1", TENANT, ["zz"]),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(coreMock.getRouter).not.toHaveBeenCalled();
    expect(coreMock.setRouterHubs).not.toHaveBeenCalled();
  });

  it("rejects routers that do not use VPN or are not in the tenant", async () => {
    await expect(
      makeService(
        vpnRouter({ connectionMode: "PUBLIC" }),
      ).service.updateServers("router-1", TENANT, ["a"]),
    ).rejects.toThrow(
      new VpnRouterInvalidError("Router ini tidak memakai VPN"),
    );
    await expect(
      makeService(vpnRouter({ vpnCoreRouterId: null })).service.updateServers(
        "router-1",
        TENANT,
        ["a"],
      ),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    await expect(
      makeService(null).service.updateServers("router-1", TENANT, ["a"]),
    ).rejects.toBeInstanceOf(RouterNotFoundError);
    expect(coreMock.setRouterHubs).not.toHaveBeenCalled();
  });

  it("answers busy and writes nothing while another send holds the router's lock", async () => {
    const { service, repo, routerOs, lock } = makeService();
    lock.isFree = false;

    await expect(
      service.updateServers("router-1", TENANT, ["c"]),
    ).rejects.toThrow(
      new VpnRouterBusyError(
        "Daftar server router ini sedang diperbarui, coba lagi sebentar",
      ),
    );
    expect(repo.withServerListLock).toHaveBeenCalledWith(
      "router-1",
      expect.any(Function),
    );
    expect(coreMock.getRouter).not.toHaveBeenCalled();
    expect(coreMock.setRouterHubs).not.toHaveBeenCalled();
    expect(coreMock.routerScript).not.toHaveBeenCalled();
    expect(repo.replaceServersAsStale).not.toHaveBeenCalled();
    expect(routerOs.writeSwitchScript).not.toHaveBeenCalled();
    expect(repo.completeScriptSend).not.toHaveBeenCalled();
  });

  it("writes nothing locally when core refuses the transitional list", async () => {
    const { service, repo } = makeService();
    coreMock.setRouterHubs.mockRejectedValue(
      new VpnCoreError(502, "unreachable"),
    );

    await expect(
      service.updateServers("router-1", TENANT, ["c"]),
    ).rejects.toBeInstanceOf(VpnCoreError);
    expect(repo.replaceServersAsStale).not.toHaveBeenCalled();
  });
});

describe("VpnRouterService.retryStaleScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    coreMock.setRouterHubs.mockImplementation(async (...args: unknown[]) => {
      calls.push(`setRouterHubs ${JSON.stringify(args)}`);
      return coreRouter();
    });
    coreMock.routerScript.mockResolvedValue(SWITCH_SCRIPT);
  });

  it("re-sends the switch script from the locally stored list", async () => {
    coreMock.getRouter.mockResolvedValue(
      coreRouter({
        hubs: [
          { hubId: "c", name: "C", priority: 0, syncState: "synced" },
          { hubId: "a", name: "A", priority: 1, syncState: "synced" },
          { hubId: "b", name: "B", priority: 2, syncState: "synced" },
        ],
      }),
    );
    const { service, repo } = makeService();

    const isSent = await service.retryStaleScript(vpnRouter(), TENANT);

    expect(isSent).toBe(true);
    expect(calls).toEqual([
      "lock router-1",
      "listServers",
      'setRouterHubs ["core-1",["c","a","b"]]',
      `writeSwitchScript [${JSON.stringify(vpnRouter())},${JSON.stringify(SWITCH_SCRIPT)}]`,
      'setRouterHubs ["core-1",["c","a"]]',
      'scriptSent ["router-1","t1"]',
      "unlock router-1",
    ]);
    expect(repo.replaceServersAsStale).not.toHaveBeenCalled();
  });

  it("leaves the script stale and skips the final PUT when a PUT replaced the list mid-send", async () => {
    coreMock.getRouter.mockResolvedValue(coreRouter());
    const { service, routerOs, stored } = makeService();
    routerOs.writeSwitchScript.mockImplementation(async () => {
      stored.ids = ["b"];
    });

    const isSent = await service.retryStaleScript(vpnRouter(), TENANT);

    expect(isSent).toBe(false);
    expect(coreMock.setRouterHubs).toHaveBeenCalledTimes(1);
    expect(coreMock.setRouterHubs).not.toHaveBeenCalledWith("core-1", [
      "c",
      "a",
    ]);
    expect(calls).toContain('scriptLeftStale ["router-1","t1"]');
  });

  it("leaves the router stale for the next cycle while a PUT holds its lock", async () => {
    const { service, repo, routerOs, lock } = makeService();
    lock.isFree = false;

    await expect(service.retryStaleScript(vpnRouter(), TENANT)).resolves.toBe(
      false,
    );
    expect(repo.listServers).not.toHaveBeenCalled();
    expect(coreMock.getRouter).not.toHaveBeenCalled();
    expect(coreMock.setRouterHubs).not.toHaveBeenCalled();
    expect(coreMock.routerScript).not.toHaveBeenCalled();
    expect(routerOs.writeSwitchScript).not.toHaveBeenCalled();
    expect(repo.completeScriptSend).not.toHaveBeenCalled();
  });

  it("reports false while the router stays unreachable", async () => {
    coreMock.getRouter.mockResolvedValue(coreRouter());
    const { service, routerOs, repo } = makeService();
    routerOs.writeSwitchScript.mockRejectedValue(new Error("ETIMEDOUT"));

    await expect(service.retryStaleScript(vpnRouter(), TENANT)).resolves.toBe(
      false,
    );
    expect(coreMock.setRouterHubs).toHaveBeenCalledTimes(1);
    expect(repo.completeScriptSend).not.toHaveBeenCalled();
  });
});

describe("VpnRouterService.getRouterVpn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags a router running on a backup server and stores the active server", async () => {
    coreMock.getRouter.mockResolvedValue(
      coreRouter({
        activeHubId: "a",
        events: [
          { fromHubId: "c", toHubId: "a", at: "2026-10-20T09:00:00.000Z" },
        ],
      }),
    );
    const { service, repo } = makeService(
      vpnRouter({ vpnActiveServerId: "c" }),
    );

    const detail = await service.getRouterVpn("router-1", TENANT);

    expect(detail).toEqual({
      servers: [
        { id: "c", name: "C", priority: 0 },
        { id: "a", name: "A", priority: 1 },
      ],
      activeServerId: "a",
      isOnBackup: true,
      lastHandshakeAt: "2026-10-20T10:00:00.000Z",
      events: [
        { fromServerId: "c", toServerId: "a", at: "2026-10-20T09:00:00.000Z" },
      ],
      scriptStale: false,
    });
    expect(repo.setActiveServer).toHaveBeenCalledWith("router-1", TENANT, "a");
  });

  it("is not on backup on the first server and skips an unchanged write", async () => {
    coreMock.getRouter.mockResolvedValue(coreRouter({ activeHubId: "c" }));
    const { service, repo } = makeService(
      vpnRouter({ vpnActiveServerId: "c" }),
    );

    const detail = await service.getRouterVpn("router-1", TENANT);

    expect(detail.isOnBackup).toBe(false);
    expect(repo.setActiveServer).not.toHaveBeenCalled();
  });
});

describe("VpnRouterService.returnToFirstServer", () => {
  const hub = (id: string, publicKey: string) => ({
    id,
    name: id.toUpperCase(),
    publicHost: `${id}.example.com`,
    listenPort: 51820,
    publicKey,
    status: "online" as const,
    routerCount: 1,
    lastSeenAt: null as string | null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.getRouter.mockResolvedValue(coreRouter());
  });

  it("points the router's peer at the priority-0 hub", async () => {
    coreMock.listHubs.mockResolvedValue([hub("b", "key-b"), hub("a", "key-a")]);
    const { service, routerOs } = makeService();

    await service.returnToFirstServer("router-1", TENANT);

    expect(routerOs.writePeerEndpoint).toHaveBeenCalledWith(vpnRouter(), {
      host: "a.example.com",
      port: 51820,
      publicKey: "key-a",
    });
  });

  it("refuses when the first hub has no public key", async () => {
    coreMock.listHubs.mockResolvedValue([hub("a", "")]);
    const { service, routerOs } = makeService();

    await expect(
      service.returnToFirstServer("router-1", TENANT),
    ).rejects.toThrow(
      new VpnRouterInvalidError("Server pertama tidak tersedia"),
    );
    expect(routerOs.writePeerEndpoint).not.toHaveBeenCalled();
  });

  it("reports an unreachable router", async () => {
    coreMock.listHubs.mockResolvedValue([hub("a", "key-a")]);
    const { service, routerOs } = makeService();
    routerOs.writePeerEndpoint.mockRejectedValue(new Error("ETIMEDOUT"));

    await expect(
      service.returnToFirstServer("router-1", TENANT),
    ).rejects.toBeInstanceOf(VpnRouterUnreachableError);
  });
});
