import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const coreMock = vi.hoisted(() => ({
  getRouter: vi.fn(),
  claimRouter: vi.fn(),
  deleteRouter: vi.fn(),
  createRouter: vi.fn(),
  routerScript: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
  isVpnConfigured: () => true,
}));

import {
  EXTRA_RADIUS_ENTRY_MESSAGE,
  OLD_RADIUS_ENTRY_WARNING,
  STUCK_VPN_MESSAGE,
  VpnRouterMigrationService,
} from "@/modules/network/services/VpnRouterMigrationService";
import { VpnDraftService } from "@/modules/network/services/VpnDraftService";
import {
  VpnCoreError,
  VpnDraftInvalidError,
  VpnRouterActivationError,
  VpnRouterInvalidError,
  VpnRouterBusyError,
  VpnRouterMigrationError,
  VpnRouterRollbackError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn";
import type { VpnMigrationRouterRecord } from "@/modules/network/domain/ports/IVpnRouterMigrationRepository";
import type { CoreRouter } from "@/modules/network/vpn/types";

const TENANT = "t1";
const NOW = Date.parse("2026-10-20T10:01:00.000Z");
const PUBLIC_IP = "198.51.100.7";
const TUNNEL_IP = "10.100.0.10";
const CORE_ADDRESS = "10.99.0.1";
const NETMANAGER_PUBLIC_IP = "203.0.113.5";

function publicRouter(
  overrides: Partial<VpnMigrationRouterRecord> = {},
): VpnMigrationRouterRecord {
  return {
    id: "router-1",
    tenantId: TENANT,
    name: "Router A",
    connectionMode: "PUBLIC",
    rosVersion: "V7",
    ipAddress: PUBLIC_IP,
    publicIpAddress: null,
    vpnCoreRouterId: null,
    apiPort: 8728,
    apiUsername: "admin",
    apiPassword: "admin-pass",
    apiUsernameGenerated: "netmanager-api",
    apiPasswordGenerated: "generated-pass",
    secretRadius: "radius-secret",
    authPort: 7265,
    accountingPort: 7266,
    isolirUrl: null,
    ...overrides,
  };
}

function vpnRouter(): VpnMigrationRouterRecord {
  return publicRouter({
    connectionMode: "VPN",
    ipAddress: TUNNEL_IP,
    publicIpAddress: PUBLIC_IP,
    vpnCoreRouterId: "core-1",
  });
}

function draft(overrides: Partial<CoreRouter> = {}): CoreRouter {
  return {
    id: "core-1",
    label: "nm:t1",
    ref: "",
    address: TUNNEL_IP,
    status: "pending",
    protocol: "wireguard",
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
  {
    id: "a",
    name: "A",
    publicHost: "a.example.com",
    status: "online",
    protocols: ["wireguard"],
  },
  {
    id: "b",
    name: "B",
    publicHost: "b.example.com",
    status: "online",
    protocols: ["wireguard"],
  },
  {
    id: "c",
    name: "C",
    publicHost: "c.example.com",
    status: "offline",
    protocols: ["wireguard"],
  },
];

function track(name: string) {
  return vi.fn(async (...args: unknown[]): Promise<void> => {
    calls.push(`${name} ${JSON.stringify(args)}`);
  });
}

const tunnelConn = {
  ip: TUNNEL_IP,
  port: 8728,
  username: "netmanager-api",
  password: "generated-pass",
};
const radiusConfig = {
  secretRadius: "radius-secret",
  authPort: 7265,
  accountingPort: 7266,
  isolirUrl: null as string | null,
};

function makeService(
  router: VpnMigrationRouterRecord | null = publicRouter(),
  tombstonedIds: string[] = [],
) {
  const repo = {
    findRouter: vi.fn().mockResolvedValue(router),
    switchToVpn: track("switchToVpn"),
    switchToPublic: track("switchToPublic"),
  };
  const routerOs = {
    testApi: vi.fn().mockResolvedValue({
      success: true,
      message: "ok",
      routerInfo: { version: "7.16.2 (stable)" },
    }),
    addRadiusEntry: track("addRadiusEntry"),
    removeRadiusEntry: track("removeRadiusEntry"),
    removeOtherRadiusEntries: vi.fn(async (...args: unknown[]) => {
      calls.push(`removeOtherRadiusEntries ${JSON.stringify(args)}`);
      return 1;
    }),
    publicRadiusAddress: vi
      .fn()
      .mockResolvedValue({ ip: NETMANAGER_PUBLIC_IP, source: "external" }),
  };
  const tombstones = {
    add: track("tombstone"),
    has: vi.fn(async (id: string) => tombstonedIds.includes(id)),
  };
  const drafts = { createExtendDraft: vi.fn() };
  const servers = { tenantServers: vi.fn().mockResolvedValue(tenantServers) };
  const service = new VpnRouterMigrationService(
    repo,
    servers,
    drafts,
    tombstones,
    routerOs,
    () => NOW,
  );
  return { service, repo, routerOs, tombstones, drafts };
}

const migrateInput = { draftId: "core-1", serverIds: ["a", "b"] };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  delete process.env.VPN_CORE_ADDRESS;
  coreMock.getRouter.mockResolvedValue(draft());
  coreMock.claimRouter.mockImplementation(async (...args: unknown[]) => {
    calls.push(`claim ${JSON.stringify(args)}`);
  });
  coreMock.deleteRouter.mockImplementation(async (...args: unknown[]) => {
    calls.push(`deleteCore ${JSON.stringify(args)}`);
  });
});

describe("VpnRouterMigrationService.enable", () => {
  it("builds the draft with the username netmanager connects with", async () => {
    const { service, drafts } = makeService();
    drafts.createExtendDraft.mockResolvedValue({ draftId: "core-1" });

    await service.enable("router-1", TENANT, {
      serverIds: ["a"],
      protocol: "WIREGUARD",
    });

    expect(drafts.createExtendDraft).toHaveBeenCalledWith(
      TENANT,
      { serverIds: ["a"], protocol: "WIREGUARD" },
      "netmanager-api",
    );
  });

  it("enable meneruskan protokol", async () => {
    const { service, drafts } = makeService();
    drafts.createExtendDraft.mockResolvedValue({ draftId: "core-1" });

    await service.enable("router-1", TENANT, {
      serverIds: ["a"],
      protocol: "L2TP",
    });

    expect(drafts.createExtendDraft).toHaveBeenCalledWith(
      TENANT,
      { serverIds: ["a"], protocol: "L2TP" },
      "netmanager-api",
    );
  });

  it.each([
    ["a VPN router", { connectionMode: "VPN" as const }],
    ["RouterOS v6", { rosVersion: "V6" as const }],
    ["a non-default API port", { apiPort: 8729 }],
  ])("refuses %s", async (_label, overrides) => {
    const { service, drafts } = makeService(publicRouter(overrides));

    await expect(
      service.enable("router-1", TENANT, {
        serverIds: ["a"],
        protocol: "WIREGUARD",
      }),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(drafts.createExtendDraft).not.toHaveBeenCalled();
  });

  it("returns an extend-mode script with the stored username quoted and no password", async () => {
    coreMock.createRouter.mockResolvedValue(draft());
    coreMock.routerScript.mockResolvedValue("/interface wireguard add");
    const router = publicRouter({
      apiUsernameGenerated: null,
      apiUsername: 'adm"in$x',
    });
    const repo = {
      findRouter: vi.fn().mockResolvedValue(router),
      switchToVpn: vi.fn(),
      switchToPublic: vi.fn(),
    };
    const servers = { tenantServers: vi.fn().mockResolvedValue(tenantServers) };
    const service = new VpnRouterMigrationService(
      repo,
      servers,
      new VpnDraftService(servers as never, () => NOW, { has: vi.fn() }),
      { add: vi.fn(), has: vi.fn() },
    );

    const result = await service.enable("router-1", TENANT, {
      serverIds: ["a", "b"],
      protocol: "WIREGUARD",
    });

    expect(result).toEqual({
      draftId: "core-1",
      address: TUNNEL_IP,
      script: expect.any(String),
    });
    expect(result.script).toContain('/user find name="adm\\"in\\$x"');
    expect(result.script).toContain(`"${CORE_ADDRESS}/32"`);
    expect(result.script).not.toContain("/user add");
    expect(result.script).not.toContain("password");
    expect(result.script).not.toContain("admin-pass");
  });
});

describe("VpnRouterMigrationService.migrate", () => {
  it("adds the tunnel RADIUS entry, switches the DB, claims, then removes the old entry", async () => {
    const { service, routerOs } = makeService();

    const result = await service.migrate("router-1", TENANT, migrateInput);

    expect(result).toEqual({});
    expect(routerOs.testApi).toHaveBeenCalledWith(tunnelConn);
    expect(calls).toEqual([
      `addRadiusEntry ${JSON.stringify([tunnelConn, CORE_ADDRESS, TUNNEL_IP, radiusConfig])}`,
      `switchToVpn ${JSON.stringify([
        publicRouter(),
        {
          tunnelAddress: TUNNEL_IP,
          coreRouterId: "core-1",
          vpnProtocol: "WIREGUARD",
          serverIds: ["a", "b"],
        },
      ])}`,
      `claim ${JSON.stringify(["core-1", "router-1"])}`,
      `removeOtherRadiusEntries ${JSON.stringify([tunnelConn, CORE_ADDRESS])}`,
    ]);
  });

  it("changes nothing and answers 502 when the tunnel RADIUS entry cannot be added", async () => {
    const { service, routerOs } = makeService();
    routerOs.addRadiusEntry.mockRejectedValue(new Error("timeout"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnRouterMigrationError);
    expect(calls).toEqual([]);
    expect(coreMock.claimRouter).not.toHaveBeenCalled();
  });

  it("removes the added entry when the DB switch fails", async () => {
    const { service, repo } = makeService();
    repo.switchToVpn.mockRejectedValue(new Error("P2002"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnRouterMigrationError);
    expect(calls).toEqual([
      `addRadiusEntry ${JSON.stringify([tunnelConn, CORE_ADDRESS, TUNNEL_IP, radiusConfig])}`,
      `removeRadiusEntry ${JSON.stringify([tunnelConn, CORE_ADDRESS])}`,
    ]);
    expect(coreMock.claimRouter).not.toHaveBeenCalled();
  });

  it("reverts the DB, removes the tunnel entry and tombstones the draft when the claim fails", async () => {
    const { service } = makeService();
    coreMock.claimRouter.mockRejectedValue(new VpnCoreError(504, "timeout"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnRouterActivationError);
    const switched = publicRouter({
      connectionMode: "VPN",
      ipAddress: TUNNEL_IP,
      publicIpAddress: PUBLIC_IP,
    });
    expect(calls.slice(2)).toEqual([
      `switchToPublic ${JSON.stringify([switched])}`,
      `removeRadiusEntry ${JSON.stringify([tunnelConn, CORE_ADDRESS])}`,
      `tombstone ${JSON.stringify(["core-1"])}`,
    ]);
  });

  it.each([
    [
      "the old entries cannot be removed",
      () => Promise.reject(new Error("trap")),
    ],
    ["no old entry is found", () => Promise.resolve(0)],
  ])("keeps the migration and warns when %s", async (_label, outcome) => {
    const { service, routerOs, repo } = makeService();
    routerOs.removeOtherRadiusEntries.mockImplementation(outcome);

    const result = await service.migrate("router-1", TENANT, migrateInput);

    expect(result).toEqual({ warning: OLD_RADIUS_ENTRY_WARNING });
    expect(repo.switchToPublic).not.toHaveBeenCalled();
    expect(coreMock.claimRouter).toHaveBeenCalled();
  });

  it("leaves the router alone when another request already moved it", async () => {
    const { service, repo } = makeService();
    repo.switchToVpn.mockRejectedValue(new VpnRouterBusyError());

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnRouterBusyError);
    expect(calls).toEqual([
      `addRadiusEntry ${JSON.stringify([tunnelConn, CORE_ADDRESS, TUNNEL_IP, radiusConfig])}`,
    ]);
    expect(coreMock.claimRouter).not.toHaveBeenCalled();
  });

  it("reports a rollback failure when the added entry cannot be removed", async () => {
    const { service, repo, routerOs } = makeService();
    repo.switchToVpn.mockRejectedValue(new Error("db down"));
    routerOs.removeRadiusEntry.mockRejectedValue(new Error("trap"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toThrow(new VpnRouterRollbackError(EXTRA_RADIUS_ENTRY_MESSAGE));
  });

  it("keeps the tunnel entry and the draft when the DB cannot be reverted after a failed claim", async () => {
    const { service, repo, routerOs, tombstones } = makeService();
    coreMock.claimRouter.mockRejectedValue(new VpnCoreError(504, "timeout"));
    repo.switchToPublic.mockRejectedValue(new Error("db down"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toThrow(new VpnRouterRollbackError(STUCK_VPN_MESSAGE));
    expect(routerOs.removeRadiusEntry).not.toHaveBeenCalled();
    expect(tombstones.add).not.toHaveBeenCalled();
  });

  it("still tombstones the draft when the tunnel entry cannot be removed after a failed claim", async () => {
    const { service, routerOs, tombstones } = makeService();
    coreMock.claimRouter.mockRejectedValue(new VpnCoreError(504, "timeout"));
    routerOs.removeRadiusEntry.mockRejectedValue(new Error("trap"));

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toThrow(new VpnRouterRollbackError(EXTRA_RADIUS_ENTRY_MESSAGE));
    expect(tombstones.add).toHaveBeenCalledWith("core-1");
  });

  it.each([
    [
      "the tunnel has no fresh handshake",
      () =>
        coreMock.getRouter.mockResolvedValue(
          draft({ lastHandshakeAt: "2026-10-20T09:00:00.000Z" }),
        ),
      VpnDraftInvalidError,
    ],
    [
      "the draft is claimed",
      () =>
        coreMock.getRouter.mockResolvedValue(
          draft({ ref: "other", status: "active" }),
        ),
      VpnDraftInvalidError,
    ],
    [
      "the draft hub order differs",
      () =>
        coreMock.getRouter.mockResolvedValue(
          draft({
            hubs: [
              { hubId: "b", name: "B", priority: 0, syncState: "synced" },
              { hubId: "a", name: "A", priority: 1, syncState: "synced" },
            ],
          }),
        ),
      VpnDraftInvalidError,
    ],
  ])("changes nothing when %s", async (_label, arrange, errorType) => {
    arrange();
    const { service, routerOs } = makeService();

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(errorType);
    expect(routerOs.addRadiusEntry).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("changes nothing when the draft is tombstoned after a failed claim", async () => {
    const { service, routerOs } = makeService(publicRouter(), ["core-1"]);

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toThrow("Draft VPN sudah tidak berlaku, buat script baru");
    expect(coreMock.getRouter).not.toHaveBeenCalled();
    expect(coreMock.claimRouter).not.toHaveBeenCalled();
    expect(routerOs.addRadiusEntry).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("rejects a router stored with a hostname before any core or RouterOS call", async () => {
    const { service, routerOs } = makeService(
      publicRouter({ ipAddress: "router.example.com" }),
    );

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toThrow(
      new VpnRouterInvalidError(
        "Ganti IP Router dengan alamat IP sebelum pindah ke VPN",
      ),
    );
    expect(coreMock.getRouter).not.toHaveBeenCalled();
    expect(routerOs.testApi).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("changes nothing when a server does not serve the draft's protocol", async () => {
    const { service } = makeService();
    coreMock.getRouter.mockResolvedValue(draft({ protocol: "l2tp" }));
    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(calls).toEqual([]);
  });

  it("changes nothing when a server is offline", async () => {
    const { service } = makeService();
    coreMock.getRouter.mockResolvedValue(
      draft({
        hubs: [{ hubId: "c", name: "C", priority: 0, syncState: "synced" }],
      }),
    );
    await expect(
      service.migrate("router-1", TENANT, {
        draftId: "core-1",
        serverIds: ["c"],
      }),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(calls).toEqual([]);
  });

  it.each([
    ["the API login fails", { success: false, message: "login failure" }],
    [
      "RouterOS is older than v7",
      { success: true, message: "ok", routerInfo: { version: "6.49.10" } },
    ],
  ])("changes nothing when %s over the tunnel", async (_label, apiResult) => {
    const { service, routerOs } = makeService();
    routerOs.testApi.mockResolvedValue(apiResult);

    await expect(
      service.migrate("router-1", TENANT, migrateInput),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(calls).toEqual([]);
  });
});

describe("VpnRouterMigrationService.testTunnel", () => {
  it("reports the RouterOS version read over the tunnel", async () => {
    const { service, routerOs } = makeService();

    await expect(
      service.testTunnel("router-1", TENANT, "core-1"),
    ).resolves.toEqual({ version: "7.16.2 (stable)" });
    expect(routerOs.testApi).toHaveBeenCalledWith(tunnelConn);
  });
});

describe("VpnRouterMigrationService.revert", () => {
  it("adds the public entry, switches the DB, removes the tunnel entry, then deletes the core router", async () => {
    const { service } = makeService(vpnRouter());

    const result = await service.revert("router-1", TENANT);

    expect(result).toEqual({});
    expect(calls).toEqual([
      `addRadiusEntry ${JSON.stringify([tunnelConn, NETMANAGER_PUBLIC_IP, null, radiusConfig])}`,
      `switchToPublic ${JSON.stringify([vpnRouter()])}`,
      `removeOtherRadiusEntries ${JSON.stringify([tunnelConn, NETMANAGER_PUBLIC_IP])}`,
      `deleteCore ${JSON.stringify(["core-1"])}`,
    ]);
  });

  it("changes nothing when the public entry cannot be added", async () => {
    const { service, routerOs } = makeService(vpnRouter());
    routerOs.addRadiusEntry.mockRejectedValue(new Error("unreachable"));

    await expect(service.revert("router-1", TENANT)).rejects.toBeInstanceOf(
      VpnRouterMigrationError,
    );
    expect(calls).toEqual([]);
  });

  it("removes the public entry again when the DB switch fails", async () => {
    const { service, repo } = makeService(vpnRouter());
    repo.switchToPublic.mockRejectedValue(new Error("db down"));

    await expect(service.revert("router-1", TENANT)).rejects.toBeInstanceOf(
      VpnRouterMigrationError,
    );
    expect(calls.slice(1)).toEqual([
      `removeRadiusEntry ${JSON.stringify([tunnelConn, NETMANAGER_PUBLIC_IP])}`,
    ]);
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
  });

  it("keeps the revert and warns when the tunnel entry cannot be removed", async () => {
    const { service, routerOs } = makeService(vpnRouter());
    routerOs.removeOtherRadiusEntries.mockRejectedValue(new Error("trap"));

    const result = await service.revert("router-1", TENANT);

    expect(result).toEqual({ warning: OLD_RADIUS_ENTRY_WARNING });
    expect(coreMock.deleteRouter).toHaveBeenCalledWith("core-1");
  });

  it("tombstones the core router when core deletion fails", async () => {
    const { service, tombstones } = makeService(vpnRouter());
    coreMock.deleteRouter.mockRejectedValue(new VpnCoreError(500, "internal"));

    await expect(service.revert("router-1", TENANT)).resolves.toEqual({});
    expect(tombstones.add).toHaveBeenCalledWith("core-1");
  });

  it("refuses with 502 when the public RADIUS address is only a local guess", async () => {
    const { service, routerOs } = makeService(vpnRouter());
    routerOs.publicRadiusAddress.mockResolvedValue({
      ip: "192.168.1.10",
      source: "local",
    });

    await expect(service.revert("router-1", TENANT)).rejects.toThrow(
      new VpnRouterMigrationError(
        "Alamat RADIUS publik tidak dapat dipastikan",
      ),
    );
    expect(calls).toEqual([]);
  });

  it("leaves the router alone when another request already reverted it", async () => {
    const { service, repo } = makeService(vpnRouter());
    repo.switchToPublic.mockRejectedValue(new VpnRouterBusyError());

    await expect(service.revert("router-1", TENANT)).rejects.toBeInstanceOf(
      VpnRouterBusyError,
    );
    expect(calls).toEqual([
      `addRadiusEntry ${JSON.stringify([tunnelConn, NETMANAGER_PUBLIC_IP, null, radiusConfig])}`,
    ]);
    expect(coreMock.deleteRouter).not.toHaveBeenCalled();
  });

  it("refuses a stored public address inside the VPN overlay before touching the router", async () => {
    const { service } = makeService({
      ...vpnRouter(),
      publicIpAddress: "::ffff:10.100.0.77",
    });

    await expect(service.revert("router-1", TENANT)).rejects.toThrow(
      "Alamat ini khusus jaringan VPN",
    );
    expect(calls).toEqual([]);
  });

  it("refuses a router whose public IP is unknown", async () => {
    const { service } = makeService({ ...vpnRouter(), publicIpAddress: null });

    await expect(service.revert("router-1", TENANT)).rejects.toBeInstanceOf(
      VpnRouterInvalidError,
    );
    expect(calls).toEqual([]);
  });
});
