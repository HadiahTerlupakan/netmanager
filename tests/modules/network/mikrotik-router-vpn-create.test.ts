import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRouter: vi.fn(),
  claimRouter: vi.fn(),
  createNas: vi.fn(),
  getNasByIp: vi.fn(),
  deleteNas: vi.fn(),
  removeOtherRadiusEntries: vi.fn(),
}));

vi.mock("@/modules/network/services/mikrotik-vpn-migration.routeros", () => ({
  vpnMigrationRouterOs: {
    removeOtherRadiusEntries: mocks.removeOtherRadiusEntries,
  },
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => ({
    getRouter: mocks.getRouter,
    claimRouter: mocks.claimRouter,
  }),
}));
vi.mock("@/modules/network/repositories/RadiusRepository", () => ({
  RadiusRepository: class {
    createNas = mocks.createNas;
    getNasByIp = mocks.getNasByIp;
    deleteNas = mocks.deleteNas;
  },
}));
vi.mock("@/modules/network/services/mikrotik-ping-check", () => ({
  checkSingleMikroTikRouterStatus: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logActivitySafe: vi.fn(),
}));

import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";
import { createRouterMutation } from "@/modules/network/services/mikrotik-router.mutations";
import {
  VpnDraftForbiddenError,
  VpnDraftInvalidError,
  VpnRouterActivationError,
  VpnRouterInvalidError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn/errors";

const TENANT = "t1";
const TUNNEL_IP = "10.100.0.10";
const SECRET = "radius-secret";

function fakeClient() {
  return {
    mikroTikRouter: {
      findFirst: vi.fn(async (args: { select?: { profilePPP?: unknown } }) =>
        args.select?.profilePPP
          ? {
              ipAddress: TUNNEL_IP,
              name: "R1",
              tenantId: TENANT,
              profilePPP: [],
            }
          : null,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: args.data.id,
        ipAddress: args.data.ipAddress,
        secretRadius: args.data.secretRadius,
        name: args.data.name,
        description: args.data.description,
        tenantId: args.data.tenantId,
      })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

const coreDraft = (overrides: object = {}) => ({
  id: "ab01",
  label: `nm:${TENANT}`,
  ref: "",
  status: "pending",
  protocol: "wireguard",
  address: TUNNEL_IP,
  hubs: [
    { hubId: "bb", name: "B", priority: 1, syncState: "synced" },
    { hubId: "aa", name: "A", priority: 0, syncState: "synced" },
  ],
  activeHubId: null as string | null,
  lastHandshakeAt: null as string | null,
  events: [] as unknown[],
  ...overrides,
});

const baseData = {
  name: "R1",
  ipAddress: TUNNEL_IP,
  apiUsername: "netmanager-0a1b2c3d",
  apiPassword: "p".repeat(32),
};

const vpnData = {
  ...baseData,
  apiPort: 8728,
  rosVersion: "V7" as const,
  connectionMode: "VPN" as const,
  vpnServerIds: ["aa", "bb"],
  vpnDraftId: "ab01",
};

function setup() {
  const client = fakeClient();
  const routerRepository = new MikroTikRouterRepository(client as never);
  const provisioningService = {
    provisionRadius: vi.fn(async () => ({ success: true, logs: [] })),
    createApiUser: vi.fn(async () => ({
      success: true,
      username: "gen",
      password: "gen-pass",
      logs: [],
    })),
  };
  const networkRepository = {
    findSettingByKey: vi.fn(async () => ({ value: SECRET })),
    findUserSite: vi.fn(),
    updateGeneratedApiUser: vi.fn(),
  };
  const vpnServerRepository = {
    tenantServerIds: vi.fn(async () => ["aa", "bb"]),
  };
  const tombstoned = new Set<string>();
  const tombstoneRepository = {
    add: vi.fn(async (id: string) => {
      tombstoned.add(id);
    }),
    has: vi.fn(async (id: string) => tombstoned.has(id)),
  };
  const run = (data: object) =>
    createRouterMutation({
      data: data as never,
      autoConfigure: true,
      userId: "u1",
      tenantId: TENANT,
      restrictedToOwnSite: false,
      routerRepository,
      networkRepository,
      provisioningService,
      vpnServerRepository,
      tombstoneRepository,
    });
  return {
    client,
    tombstoneRepository,
    routerRepository,
    provisioningService,
    networkRepository,
    vpnServerRepository,
    run,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createRouterMutation mode VPN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RADIUS_SECRET", "");
    vi.stubEnv("VPN_CORE_ADDRESS", "");
    mocks.getRouter.mockResolvedValue(coreDraft());
    mocks.claimRouter.mockResolvedValue(coreDraft({ ref: "x" }));
    mocks.getNasByIp.mockResolvedValue({ id: 77 });
  });

  it("menyimpan router + urutan server, claim draft, lalu provisioning lewat tunnel", async () => {
    const t = setup();

    const { id } = await t.run(vpnData);

    const createArgs = t.client.mikroTikRouter.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      ipAddress: TUNNEL_IP,
      apiPort: 8728,
      rosVersion: "V7",
      connectionMode: "VPN",
      vpnAddress: TUNNEL_IP,
      vpnCoreRouterId: "ab01",
      vpnServers: {
        create: [
          { vpnServerId: "aa", priority: 0 },
          { vpnServerId: "bb", priority: 1 },
        ],
      },
    });
    expect(mocks.claimRouter).toHaveBeenCalledWith("ab01", id);
    expect(t.provisioningService.provisionRadius).toHaveBeenCalledWith(
      {
        ip: TUNNEL_IP,
        port: 8728,
        username: baseData.apiUsername,
        password: baseData.apiPassword,
      },
      "10.99.0.1",
      SECRET,
      undefined,
      expect.any(Number),
      expect.any(Number),
      TUNNEL_IP,
    );
    expect(mocks.claimRouter.mock.invocationCallOrder[0]).toBeLessThan(
      t.provisioningService.provisionRadius.mock.invocationCallOrder[0],
    );
    expect(t.provisioningService.createApiUser).not.toHaveBeenCalled();
    expect(t.networkRepository.updateGeneratedApiUser).not.toHaveBeenCalled();
  });

  it("createVpnRouter menyimpan vpnProtocol L2TP", async () => {
    mocks.getRouter.mockResolvedValue(coreDraft({ protocol: "l2tp" }));
    const t = setup();

    await t.run({ ...vpnData, vpnProtocol: "L2TP" });

    const createArgs = t.client.mikroTikRouter.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({ vpnProtocol: "L2TP" });
  });

  it("createVpnRouter menolak draft yang protokolnya beda dari request", async () => {
    const t = setup();

    const error = await t
      .run({ ...vpnData, vpnProtocol: "L2TP" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VpnDraftInvalidError);
    expect((error as Error).message).toBe(
      "Protokol VPN tidak cocok dengan draft VPN",
    );
    expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
    expect(mocks.claimRouter).not.toHaveBeenCalled();
  });

  it("menghapus entri RADIUS netmanager lama setelah entri tunnel terpasang", async () => {
    const t = setup();

    await t.run(vpnData);

    expect(mocks.removeOtherRadiusEntries).toHaveBeenCalledWith(
      {
        ip: TUNNEL_IP,
        port: 8728,
        username: baseData.apiUsername,
        password: baseData.apiPassword,
      },
      "10.99.0.1",
    );
    expect(
      t.provisioningService.provisionRadius.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.removeOtherRadiusEntries.mock.invocationCallOrder[0]);
  });

  it("tidak menghapus entri lama bila entri tunnel gagal dipasang", async () => {
    const t = setup();
    t.provisioningService.provisionRadius.mockResolvedValue({
      success: false,
      logs: ["timeout"],
    });

    await t.run(vpnData);

    expect(mocks.removeOtherRadiusEntries).not.toHaveBeenCalled();
  });

  it("pembersihan entri lama yang gagal tidak menggagalkan create", async () => {
    mocks.removeOtherRadiusEntries.mockRejectedValue(new Error("ETIMEDOUT"));
    const t = setup();

    await expect(t.run(vpnData)).resolves.toEqual({
      id: expect.any(String),
    });
  });

  it("menolak draft milik tenant lain tanpa menulis ke database", async () => {
    mocks.getRouter.mockResolvedValue(coreDraft({ label: "nm:t2" }));
    const t = setup();

    await expect(t.run(vpnData)).rejects.toBeInstanceOf(VpnDraftForbiddenError);
    expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
  });

  it.each([
    ["sudah di-claim", { ref: "router-lain" }, "Draft VPN sudah dipakai"],
    ["sudah aktif", { status: "active" }, "Draft VPN sudah dipakai"],
    [
      "alamat beda",
      { address: "10.100.0.11" },
      "IP Router tidak cocok dengan draft VPN",
    ],
    [
      "urutan hub beda",
      {
        hubs: [
          { hubId: "bb", name: "B", priority: 0, syncState: "synced" },
          { hubId: "aa", name: "A", priority: 1, syncState: "synced" },
        ],
      },
      "Server VPN tidak cocok dengan draft VPN",
    ],
  ])("menolak draft yang %s", async (_case, overrides, message) => {
    mocks.getRouter.mockResolvedValue(coreDraft(overrides));
    const t = setup();

    const error = await t.run(vpnData).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VpnDraftInvalidError);
    expect((error as Error).message).toBe(message);
    expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
    expect(mocks.claimRouter).not.toHaveBeenCalled();
  });

  it("menolak server yang tidak lagi di-assign ke tenant", async () => {
    const t = setup();
    t.vpnServerRepository.tenantServerIds.mockResolvedValue(["aa"]);

    await expect(t.run(vpnData)).rejects.toBeInstanceOf(
      VpnServerNotAvailableError,
    );
    expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
  });

  it("menghapus router beserta NAS-nya bila claim gagal, tanpa provisioning", async () => {
    mocks.claimRouter.mockRejectedValue(new Error("core down"));
    const t = setup();

    await expect(t.run(vpnData)).rejects.toBeInstanceOf(
      VpnRouterActivationError,
    );

    const createdId = (
      t.client.mikroTikRouter.create.mock.calls[0][0] as {
        data: { id: string };
      }
    ).data.id;
    expect(t.client.mikroTikRouter.deleteMany).toHaveBeenCalledWith({
      where: { id: createdId, tenantId: TENANT },
    });
    expect(mocks.deleteNas).toHaveBeenCalledWith(77, TENANT);
    expect(t.provisioningService.provisionRadius).not.toHaveBeenCalled();
    expect(t.tombstoneRepository.add).toHaveBeenCalledWith("ab01");
  });

  it("menolak draft yang sudah di-tombstone tanpa claim kedua", async () => {
    mocks.claimRouter.mockRejectedValueOnce(new Error("core timeout"));
    const t = setup();
    await expect(t.run(vpnData)).rejects.toBeInstanceOf(
      VpnRouterActivationError,
    );

    const retry = t.run(vpnData);

    await expect(retry).rejects.toBeInstanceOf(VpnDraftInvalidError);
    await expect(retry).rejects.toThrow(
      "Draft VPN sudah tidak berlaku, buat script baru",
    );
    expect(mocks.claimRouter).toHaveBeenCalledTimes(1);
    expect(t.client.mikroTikRouter.create).toHaveBeenCalledTimes(1);
  });
});

describe("createRouterMutation mode PUBLIC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RADIUS_SECRET", "");
  });

  it.each([
    ["nama host", "router.example.com"],
    ["zone id", "fe80::1%eth0"],
    ["IPv4-mapped IPv6", "::ffff:10.100.0.10"],
    ["nol di depan", "010.100.0.10"],
  ])("menolak alamat %s tanpa menulis", async (_label, ipAddress) => {
    const t = setup();

    await expect(
      t.run({ ...baseData, ipAddress, apiPort: 8728 }),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
  });

  it.each(["10.99.0.7", "10.100.0.10"])(
    "menolak alamat overlay VPN %s tanpa menulis",
    async (ipAddress) => {
      const t = setup();

      await expect(
        t.run({ ...baseData, ipAddress, apiPort: 8728 }),
      ).rejects.toThrow("Alamat ini khusus jaringan VPN");
      expect(t.client.mikroTikRouter.create).not.toHaveBeenCalled();
    },
  );

  it("payload repository dan provisioning sama seperti sebelum mode VPN", async () => {
    const t = setup();
    const createSpy = vi.spyOn(t.routerRepository, "create");

    const publicData = { ...baseData, ipAddress: "203.0.113.20" };
    await t.run({ ...publicData, apiPort: 8728, isolirUrl: "http://isolir" });

    expect(createSpy).toHaveBeenCalledWith({
      ...publicData,
      apiPort: 8728,
      isolirUrl: "http://isolir",
      authPort: expect.any(Number),
      accountingPort: expect.any(Number),
      secretRadius: SECRET,
      siteId: null,
      tenantId: TENANT,
    });
    const prismaData = (
      t.client.mikroTikRouter.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(Object.keys(prismaData).sort()).toEqual(
      [
        "id",
        "updatedAt",
        "name",
        "ipAddress",
        "timezone",
        "apiPort",
        "apiUsername",
        "apiPassword",
        "authPort",
        "accountingPort",
        "secretRadius",
        "isolirUrl",
        "description",
        "pingStatus",
        "userOnline",
        "siteId",
        "tenantId",
      ].sort(),
    );
    expect(t.provisioningService.provisionRadius.mock.calls[0]).toEqual([
      {
        ip: publicData.ipAddress,
        port: 8728,
        username: baseData.apiUsername,
        password: baseData.apiPassword,
      },
      null,
      SECRET,
      "http://isolir",
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(t.provisioningService.createApiUser).toHaveBeenCalled();
    expect(t.networkRepository.updateGeneratedApiUser).toHaveBeenCalled();
    expect(mocks.getRouter).not.toHaveBeenCalled();
    expect(mocks.claimRouter).not.toHaveBeenCalled();
    expect(mocks.removeOtherRadiusEntries).not.toHaveBeenCalled();
  });
});
