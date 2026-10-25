import { beforeEach, describe, expect, it, vi } from "vitest";

const nas = vi.hoisted(() => ({
  getNasByIp: vi.fn(),
  updateNas: vi.fn(),
  createNas: vi.fn(),
}));

vi.mock("@/modules/network/repositories/RadiusRepository", () => ({
  RadiusRepository: class {
    getNasByIp = nas.getNasByIp;
    updateNas = nas.updateNas;
    createNas = nas.createNas;
  },
}));

import { MikroTikRouterVpnMigrationRepository } from "@/modules/network/repositories/MikroTikRouterVpnMigrationRepository";
import type { VpnMigrationRouterRecord } from "@/modules/network/domain/ports/IVpnRouterMigrationRepository";
import { VpnRouterBusyError } from "@/modules/network/vpn";

const router: VpnMigrationRouterRecord = {
  id: "router-1",
  tenantId: "t1",
  name: "Router A",
  connectionMode: "PUBLIC",
  rosVersion: "V7",
  ipAddress: "198.51.100.7",
  publicIpAddress: null,
  vpnCoreRouterId: null,
  apiPort: 8728,
  apiUsername: "admin",
  apiPassword: "x",
  apiUsernameGenerated: null,
  apiPasswordGenerated: null,
  secretRadius: "radius-secret",
  authPort: 7265,
  accountingPort: 7266,
  isolirMode: "ROUTER_PAGE",
  isolirUrl: null,
};

function makeRepo(updatedCount = 1, commitError?: Error) {
  const tx = {
    mikroTikRouter: {
      updateMany: vi.fn().mockResolvedValue({ count: updatedCount }),
    },
    mikroTikRouterVpnServer: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const client = {
    $transaction: vi.fn(async (run: (t: typeof tx) => Promise<void>) => {
      await run(tx);
      if (commitError) throw commitError;
    }),
  };
  return {
    tx,
    repo: new MikroTikRouterVpnMigrationRepository(client as never),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  nas.getNasByIp.mockResolvedValue({ id: 42 });
});

describe("MikroTikRouterVpnMigrationRepository", () => {
  it("moves the router and its NAS nasname to the tunnel address", async () => {
    const { repo, tx } = makeRepo();

    await repo.switchToVpn(router, {
      tunnelAddress: "10.100.0.10",
      coreRouterId: "core-1",
      vpnProtocol: "WIREGUARD",
      serverIds: ["a", "b"],
    });

    expect(tx.mikroTikRouter.updateMany).toHaveBeenCalledWith({
      where: { id: "router-1", tenantId: "t1", connectionMode: "PUBLIC" },
      data: expect.objectContaining({
        publicIpAddress: "198.51.100.7",
        ipAddress: "10.100.0.10",
        vpnAddress: "10.100.0.10",
        connectionMode: "VPN",
        vpnCoreRouterId: "core-1",
        vpnProtocol: "WIREGUARD",
      }),
    });
    expect(tx.mikroTikRouterVpnServer.createMany).toHaveBeenCalledWith({
      data: [
        { routerId: "router-1", vpnServerId: "a", priority: 0 },
        { routerId: "router-1", vpnServerId: "b", priority: 1 },
      ],
    });
    expect(nas.getNasByIp).toHaveBeenCalledWith("198.51.100.7", "t1");
    expect(nas.updateNas).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ nasname: "10.100.0.10" }),
      "t1",
    );
  });

  it("fails the switch when the NAS cannot follow", async () => {
    const { repo } = makeRepo();
    nas.updateNas.mockRejectedValue(new Error("radius db down"));

    await expect(
      repo.switchToVpn(router, {
        tunnelAddress: "10.100.0.10",
        coreRouterId: "core-1",
        vpnProtocol: "WIREGUARD",
        serverIds: ["a"],
      }),
    ).rejects.toThrow("radius db down");
  });

  it("writes nothing else when the router is no longer public", async () => {
    const { repo, tx } = makeRepo(0);

    await expect(
      repo.switchToVpn(router, {
        tunnelAddress: "10.100.0.10",
        coreRouterId: "core-1",
        vpnProtocol: "WIREGUARD",
        serverIds: ["a"],
      }),
    ).rejects.toBeInstanceOf(VpnRouterBusyError);
    expect(tx.mikroTikRouterVpnServer.createMany).not.toHaveBeenCalled();
    expect(nas.updateNas).not.toHaveBeenCalled();
  });

  it("moves a VPN router and its NAS back to the public address", async () => {
    const { repo, tx } = makeRepo();

    await repo.switchToPublic({
      ...router,
      connectionMode: "VPN",
      ipAddress: "10.100.0.10",
      publicIpAddress: "198.51.100.7",
      vpnCoreRouterId: "core-1",
    });

    expect(tx.mikroTikRouter.updateMany).toHaveBeenCalledWith({
      where: { id: "router-1", tenantId: "t1", connectionMode: "VPN" },
      data: expect.objectContaining({
        ipAddress: "198.51.100.7",
        publicIpAddress: null,
        connectionMode: "PUBLIC",
        vpnAddress: null,
        vpnCoreRouterId: null,
        vpnActiveServerId: null,
        vpnScriptStale: false,
      }),
    });
    expect(tx.mikroTikRouterVpnServer.deleteMany).toHaveBeenCalledWith({
      where: { routerId: "router-1" },
    });
    expect(nas.getNasByIp).toHaveBeenCalledWith("10.100.0.10", "t1");
    expect(nas.updateNas).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ nasname: "198.51.100.7" }),
      "t1",
    );
  });

  it("moves the nasname back when the commit fails after the NAS moved", async () => {
    const { repo } = makeRepo(1, new Error("commit failed"));

    await expect(
      repo.switchToVpn(router, {
        tunnelAddress: "10.100.0.10",
        coreRouterId: "core-1",
        vpnProtocol: "WIREGUARD",
        serverIds: ["a"],
      }),
    ).rejects.toThrow("commit failed");
    expect(nas.getNasByIp.mock.calls).toEqual([
      ["198.51.100.7", "t1"],
      ["10.100.0.10", "t1"],
    ]);
    expect(nas.updateNas.mock.calls.map((c) => c[1].nasname)).toEqual([
      "10.100.0.10",
      "198.51.100.7",
    ]);
  });

  it("moves the nasname back to the tunnel when a revert commit fails", async () => {
    const { repo } = makeRepo(1, new Error("commit failed"));

    await expect(
      repo.switchToPublic({
        ...router,
        connectionMode: "VPN",
        ipAddress: "10.100.0.10",
        publicIpAddress: "198.51.100.7",
      }),
    ).rejects.toThrow("commit failed");
    expect(nas.updateNas.mock.calls.map((c) => c[1].nasname)).toEqual([
      "198.51.100.7",
      "10.100.0.10",
    ]);
  });
});
