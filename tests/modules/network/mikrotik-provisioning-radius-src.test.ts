import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveIsolirContent: vi.fn() }));

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));
vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: mocks.resolveIsolirContent,
}));

import { renderIsolirPage } from "@/modules/network/isolir/isolir-render";
import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";
import { provisionRadiusConfig } from "@/modules/network/services/mikrotik-provisioning.radius";
import { RouterReconfigureRouteService } from "@/modules/network/services/RouterReconfigureRouteService";

const SERVER_IP = "10.99.0.1";
const TUNNEL_IP = "10.100.0.10";

function fakeConnection(existing: { ".id": string }[]) {
  return {
    write: vi.fn<(path: string, args: string[]) => Promise<unknown>>(
      async (path) => (path === "/radius/print" ? existing : []),
    ),
  };
}

function provision(
  connection: ReturnType<typeof fakeConnection>,
  srcAddress?: string | null,
) {
  return provisionRadiusConfig({
    connection: connection as never,
    serverIp: SERVER_IP,
    radiusSecret: "s",
    authPort: 1812,
    accountingPort: 1813,
    logs: [],
    srcAddress,
  });
}

function writtenArgs(
  connection: ReturnType<typeof fakeConnection>,
  path: string,
) {
  return connection.write.mock.calls.find((call) => call[0] === path)?.[1];
}

describe("provisionRadiusConfig src-address", () => {
  it("menambahkan src-address pada /radius/add bila diberikan", async () => {
    const connection = fakeConnection([]);
    await provision(connection, TUNNEL_IP);

    const args = writtenArgs(connection, "/radius/add");
    expect(args).toContain(`=address=${SERVER_IP}`);
    expect(args).toContain(`=src-address=${TUNNEL_IP}`);
  });

  it("menambahkan src-address pada /radius/set bila entri sudah ada", async () => {
    const connection = fakeConnection([{ ".id": "*1" }]);
    await provision(connection, TUNNEL_IP);

    expect(writtenArgs(connection, "/radius/set")).toContain(
      `=src-address=${TUNNEL_IP}`,
    );
  });

  it.each([null, undefined])(
    "tanpa src-address (%s) perintah sama seperti sebelumnya",
    async (srcAddress) => {
      const addConnection = fakeConnection([]);
      await provision(addConnection, srcAddress);
      const setConnection = fakeConnection([{ ".id": "*1" }]);
      await provision(setConnection, srcAddress);

      expect(writtenArgs(addConnection, "/radius/add")).toEqual([
        `=address=${SERVER_IP}`,
        "=secret=s",
        "=service=ppp,login,hotspot",
        "=authentication-port=1812",
        "=accounting-port=1813",
        "=timeout=3000ms",
        "=comment=added by netmanager",
      ]);
      expect(writtenArgs(setConnection, "/radius/set")).toEqual([
        "=.id=*1",
        "=secret=s",
        "=service=ppp,login,hotspot",
        "=authentication-port=1812",
        "=accounting-port=1813",
        "=timeout=3000ms",
      ]);
    },
  );
});

describe("RouterReconfigureRouteService alamat RADIUS", () => {
  const storedRouter = (connectionMode: "PUBLIC" | "VPN") => ({
    id: "r1",
    name: "R1",
    ipAddress: TUNNEL_IP,
    apiPort: 8728,
    pingStatus: "online",
    apiUsername: "u",
    apiPassword: "p",
    apiUsernameGenerated: null as string | null,
    apiPasswordGenerated: null as string | null,
    siteId: null as string | null,
    connectionMode,
    isolirMode: "ROUTER_PAGE" as "ROUTER_PAGE" | "REDIRECT",
    isolirUrl: null as string | null,
    tenantId: "t1" as string | null,
  });

  const content: IsolirContent = {
    ispName: "Net Tenant",
    title: "Judul",
    message: "Pesan",
    logoDataUri: null,
    payments: [],
    whatsapp: null,
    link: null,
    contactText: null,
    primaryColor: "#1d4ed8",
  };

  function setup(
    connectionMode: "PUBLIC" | "VPN",
    isolir: Partial<ReturnType<typeof storedRouter>> = {},
  ) {
    const provisioningService = {
      provisionRadius: vi.fn<
        (...args: unknown[]) => Promise<{
          success: boolean;
          logs: string[];
          error?: string;
          isolirPageError?: string;
        }>
      >(async () => ({ success: true, logs: [] })),
    };
    const routerService = { getRouterById: vi.fn(async () => ({ id: "r1" })) };
    const networkRepository = {
      findSettingsByKeys: vi.fn(async () => [
        { key: "RADIUS_SECRET", value: "s" },
        { key: "ISOLIR_URL", value: "https://isolir.global.id" },
      ]),
      findRouterForReconfigure: vi.fn(async () => ({
        ...storedRouter(connectionMode),
        ...isolir,
      })),
      updateIsolirPageSync: vi.fn(async () => undefined),
    };
    const service = new RouterReconfigureRouteService(
      provisioningService as never,
      routerService as never,
      networkRepository as never,
    );
    return { service, provisioningService, networkRepository };
  }

  const context = { tenantId: "t1", userId: "u1", restrictedToOwnSite: false };

  beforeEach(() => {
    vi.stubEnv("RADIUS_SECRET", "");
    vi.stubEnv("VPN_CORE_ADDRESS", "");
    mocks.resolveIsolirContent.mockReset();
    mocks.resolveIsolirContent.mockResolvedValue(content);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("router VPN memakai alamat core dan IP tunnel sebagai src-address", async () => {
    const { service, provisioningService } = setup("VPN");
    await service.reconfigureRouters(["r1"], {
      tenantId: "t1",
      userId: "u1",
      restrictedToOwnSite: false,
    });

    const call = provisioningService.provisionRadius.mock.calls[0] as unknown[];
    expect(call[1]).toBe(SERVER_IP);
    expect(call[6]).toBe(TUNNEL_IP);
  });

  it("router PUBLIC tetap memakai deteksi IP publik dan tanpa src-address", async () => {
    const { service, provisioningService } = setup("PUBLIC");
    await service.reconfigureRouters(["r1"], {
      tenantId: "t1",
      userId: "u1",
      restrictedToOwnSite: false,
    });

    const call = provisioningService.provisionRadius.mock.calls[0] as unknown[];
    expect(call[1]).toBeNull();
    expect(call[6]).toBeUndefined();
  });

  it.each(["PUBLIC", "VPN"] as const)(
    "router %s memakai port RADIUS yang sama dengan saat router ditambahkan",
    async (mode) => {
      vi.stubEnv("RADIUS_AUTH_PORT", "30812");
      vi.stubEnv("RADIUS_ACCT_PORT", "30813");
      const { service, provisioningService } = setup(mode);
      await service.reconfigureRouters(["r1"], {
        tenantId: "t1",
        userId: "u1",
        restrictedToOwnSite: false,
      });

      const call = provisioningService.provisionRadius.mock
        .calls[0] as unknown[];
      expect(call[4]).toBe(30812);
      expect(call[5]).toBe(30813);
    },
  );

  it("router REDIRECT memakai URL miliknya sendiri, bukan ISOLIR_URL global", async () => {
    const { service, provisioningService, networkRepository } = setup("VPN", {
      isolirMode: "REDIRECT",
      isolirUrl: "https://isolir.router.id/bayar",
    });
    await service.reconfigureRouters(["r1"], context);

    const call = provisioningService.provisionRadius.mock.calls[0];
    expect(call[3]).toEqual({
      mode: "REDIRECT",
      target: "isolir.router.id/bayar",
    });
    expect(networkRepository.updateIsolirPageSync).not.toHaveBeenCalled();
  });

  it("router ROUTER_PAGE mengirim halaman tenant router dan mencatat hash-nya", async () => {
    const { service, provisioningService, networkRepository } = setup(
      "PUBLIC",
      {
        tenantId: "t-router",
      },
    );
    await service.reconfigureRouters(["r1"], context);

    const { html, hash } = renderIsolirPage(content);
    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith("t-router");
    expect(provisioningService.provisionRadius.mock.calls[0][3]).toEqual({
      mode: "ROUTER_PAGE",
      html,
      hash,
    });
    expect(networkRepository.updateIsolirPageSync).toHaveBeenCalledWith("r1", {
      hash,
      syncedAt: expect.any(Date),
      error: null,
    });
  });

  it.each([
    [
      "provisioning gagal",
      { success: false, logs: [], error: "timeout" },
      "timeout",
    ],
    [
      "halaman gagal ditulis",
      { success: true, logs: [], isolirPageError: "disk full" },
      "disk full",
    ],
  ])(
    "router ROUTER_PAGE: %s mencatat galat tanpa hash",
    async (_case, result, error) => {
      const { service, provisioningService, networkRepository } =
        setup("PUBLIC");
      provisioningService.provisionRadius.mockResolvedValue(result);
      await service.reconfigureRouters(["r1"], context);

      expect(networkRepository.updateIsolirPageSync).toHaveBeenCalledWith(
        "r1",
        { hash: null, error },
      );
    },
  );

  it("galat menyusun halaman tidak menghentikan provisioning dan dicatat", async () => {
    mocks.resolveIsolirContent.mockRejectedValue(new Error("db down"));
    const { service, provisioningService, networkRepository } = setup("PUBLIC");

    await service.reconfigureRouters(["r1"], context);

    expect(provisioningService.provisionRadius).toHaveBeenCalledTimes(1);
    expect(provisioningService.provisionRadius.mock.calls[0][3]).toBeNull();
    expect(networkRepository.updateIsolirPageSync).toHaveBeenCalledWith("r1", {
      hash: null,
      error: "db down",
    });
  });
});
