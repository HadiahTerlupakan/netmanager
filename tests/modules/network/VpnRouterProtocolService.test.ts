import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  protocolScript: vi.fn(),
  setRouterProtocol: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
}));

import { VpnRouterProtocolService } from "@/modules/network/services/VpnRouterProtocolService";
import { RouterNotFoundError } from "@/modules/network/services/mikrotik-router.access";
import {
  VpnCoreError,
  VpnRouterInvalidError,
  VpnServerNotAvailableError,
} from "@/modules/network/vpn";
import type { VpnRouterRecord } from "@/modules/network/domain/ports/IMikroTikRouterVpnRepository";

const TENANT = "t1";
const L2TP_SCRIPT = "/interface l2tp-client add name=netmanager-vpn";

function vpnRouter(overrides: Partial<VpnRouterRecord> = {}): VpnRouterRecord {
  return {
    id: "router-1",
    connectionMode: "VPN",
    vpnCoreRouterId: "core-1",
    vpnActiveServerId: "a",
    vpnScriptStale: false,
    vpnProtocol: "WIREGUARD",
    ipAddress: "10.100.0.10",
    apiPort: 8728,
    apiUsername: "u",
    apiPassword: "p",
    apiUsernameGenerated: null,
    apiPasswordGenerated: null,
    ...overrides,
  };
}

const server = (id: string, protocols: string[]) => ({
  id,
  name: id.toUpperCase(),
  publicHost: `${id}.example.com`,
  status: "online",
  protocols,
});

function makeService(
  router: VpnRouterRecord | null = vpnRouter(),
  tenantServers = [
    server("a", ["wireguard", "l2tp"]),
    server("b", ["wireguard", "l2tp"]),
  ],
) {
  const repo = {
    findRouter: vi.fn().mockResolvedValue(router),
    listServers: vi.fn().mockResolvedValue([
      { id: "a", name: "A", priority: 0 },
      { id: "b", name: "B", priority: 1 },
    ]),
    setVpnProtocol: vi.fn().mockResolvedValue(undefined),
    replaceServersAsStale: vi.fn(),
    withServerListLock: vi.fn(),
    completeScriptSend: vi.fn(),
    setActiveServer: vi.fn(),
    findStaleOnline: vi.fn(),
  };
  const servers = { tenantServers: vi.fn().mockResolvedValue(tenantServers) };
  return { service: new VpnRouterProtocolService(repo, servers), repo };
}

describe("VpnRouterProtocolService.previewScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMock.protocolScript.mockResolvedValue(L2TP_SCRIPT);
  });

  it("previewScript tidak mengubah vpnProtocol", async () => {
    const { service, repo } = makeService();

    const script = await service.previewScript("router-1", TENANT, "L2TP");

    expect(script).toBe(L2TP_SCRIPT);
    expect(coreMock.protocolScript).toHaveBeenCalledWith("core-1", "l2tp");
    expect(repo.setVpnProtocol).not.toHaveBeenCalled();
    expect(coreMock.setRouterProtocol).not.toHaveBeenCalled();
  });

  it("previewScript menolak server router yang tidak mendukung protokol", async () => {
    const { service } = makeService(vpnRouter(), [
      server("a", ["wireguard", "l2tp"]),
      server("b", ["wireguard"]),
    ]);

    await expect(
      service.previewScript("router-1", TENANT, "L2TP"),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(coreMock.protocolScript).not.toHaveBeenCalled();
  });

  it("menolak protokol yang sedang dipakai router", async () => {
    const { service } = makeService(vpnRouter({ vpnProtocol: "L2TP" }));

    await expect(
      service.previewScript("router-1", TENANT, "L2TP"),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(coreMock.protocolScript).not.toHaveBeenCalled();
  });

  it("menolak router di luar tenant dan router publik", async () => {
    await expect(
      makeService(null).service.previewScript("router-1", TENANT, "L2TP"),
    ).rejects.toBeInstanceOf(RouterNotFoundError);
    await expect(
      makeService(
        vpnRouter({ connectionMode: "PUBLIC", vpnCoreRouterId: null }),
      ).service.previewScript("router-1", TENANT, "L2TP"),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
  });
});

describe("VpnRouterProtocolService.apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apply memanggil core.setRouterProtocol lalu menyimpan vpnProtocol", async () => {
    const order: string[] = [];
    coreMock.setRouterProtocol.mockImplementation(async () => {
      order.push("core");
      return {};
    });
    const { service, repo } = makeService();
    repo.setVpnProtocol.mockImplementation(async () => {
      order.push("db");
    });

    await service.apply("router-1", TENANT, "L2TP");

    expect(coreMock.setRouterProtocol).toHaveBeenCalledWith("core-1", "l2tp");
    expect(repo.setVpnProtocol).toHaveBeenCalledWith(
      "router-1",
      TENANT,
      "L2TP",
    );
    expect(order).toEqual(["core", "db"]);
  });

  it("apply gagal di core tidak mengubah DB", async () => {
    coreMock.setRouterProtocol.mockRejectedValue(
      new VpnCoreError(400, "validation", "hub does not serve l2tp"),
    );
    const { service, repo } = makeService();

    await expect(
      service.apply("router-1", TENANT, "L2TP"),
    ).rejects.toBeInstanceOf(VpnCoreError);
    expect(repo.setVpnProtocol).not.toHaveBeenCalled();
  });

  it("menolak protokol yang sedang dipakai router tanpa memanggil core", async () => {
    const { service, repo } = makeService();

    await expect(
      service.apply("router-1", TENANT, "WIREGUARD"),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(coreMock.setRouterProtocol).not.toHaveBeenCalled();
    expect(repo.setVpnProtocol).not.toHaveBeenCalled();
  });
});
