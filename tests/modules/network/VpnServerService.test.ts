import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMock = vi.hoisted(() => ({
  listHubs: vi.fn(),
  createHub: vi.fn(),
  deleteHub: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
}));

import { VpnServerService } from "@/modules/network/services/VpnServerService";
import { VpnCoreError, VpnServerInUseError } from "@/modules/network/vpn";
import { VpnServerRepository } from "@/modules/network/repositories/VpnServerRepository";
import type { PrismaClient } from "@prisma/client";
import type { IVpnServerRepository } from "@/modules/network/domain/ports/IVpnServerRepository";

const hub = {
  id: "hub-1",
  name: "Jakarta",
  publicHost: "vpn.example.com",
  listenPort: 51821,
  status: "online" as const,
  protocols: ["wireguard", "l2tp"],
  routerCount: 0,
  lastSeenAt: "2026-10-20T01:00:00.000Z",
};

function makeRepo() {
  return {
    upsertHub: vi.fn().mockResolvedValue(undefined),
    tenantCounts: vi.fn().mockResolvedValue(new Map([["hub-1", 3]])),
    routersUsing: vi.fn().mockResolvedValue([]),
    deleteServer: vi.fn().mockResolvedValue(undefined),
    tenantServerIds: vi.fn().mockResolvedValue([]),
    countExisting: vi.fn().mockResolvedValue(0),
    replaceTenantServers: vi.fn().mockResolvedValue(undefined),
  };
}

describe("VpnServerService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: VpnServerService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepo();
    service = new VpnServerService(repo as unknown as IVpnServerRepository);
  });

  it("listServers upserts each hub with its status and adds tenantCount", async () => {
    coreMock.listHubs.mockResolvedValue([hub]);

    const result = await service.listServers();

    expect(repo.upsertHub).toHaveBeenCalledWith(hub);
    expect(result).toEqual([{ ...hub, tenantCount: 3 }]);
  });

  it("refreshServerStatuses upserts every hub from one listHubs call", async () => {
    coreMock.listHubs.mockResolvedValue([hub, { ...hub, id: "hub-2" }]);

    await service.refreshServerStatuses();

    expect(coreMock.listHubs).toHaveBeenCalledTimes(1);
    expect(repo.upsertHub).toHaveBeenCalledTimes(2);
    expect(repo.tenantCounts).not.toHaveBeenCalled();
  });

  it("createServer defaults the port and rolls the hub back when the insert fails", async () => {
    coreMock.createHub.mockResolvedValue({ hub, installCommand: "curl x" });
    coreMock.deleteHub.mockResolvedValue(undefined);
    repo.upsertHub.mockRejectedValue(new Error("db down"));

    await expect(
      service.createServer({ name: "Jakarta", publicHost: "vpn.example.com" }),
    ).rejects.toThrow("db down");

    expect(coreMock.createHub).toHaveBeenCalledWith(
      expect.objectContaining({ listenPort: 51821 }),
    );
    expect(coreMock.deleteHub).toHaveBeenCalledWith("hub-1");
  });

  it("createServer returns the view and install command on success", async () => {
    coreMock.createHub.mockResolvedValue({ hub, installCommand: "curl x" });

    const result = await service.createServer({
      name: "Jakarta",
      publicHost: "vpn.example.com",
      listenPort: 51821,
    });

    expect(result).toEqual({
      server: { ...hub, tenantCount: 0 },
      installCommand: "curl x",
    });
  });

  it("deleteServer rejects with the router list and never calls core", async () => {
    const routers = [{ id: "r1", name: "RB1", tenantName: "Tenant A" }];
    repo.routersUsing.mockResolvedValue(routers);

    const error = await service.deleteServer("hub-1").catch((e) => e);

    expect(error).toBeInstanceOf(VpnServerInUseError);
    expect(error.routers).toEqual(routers);
    expect(coreMock.deleteHub).not.toHaveBeenCalled();
    expect(repo.deleteServer).not.toHaveBeenCalled();
  });

  it("deleteServer maps a core 409 to VpnServerInUseError", async () => {
    coreMock.deleteHub.mockRejectedValue(new VpnCoreError(409, "in_use"));

    await expect(service.deleteServer("hub-1")).rejects.toBeInstanceOf(
      VpnServerInUseError,
    );
    expect(repo.deleteServer).not.toHaveBeenCalled();
  });

  it("deleteServer treats a core 404 as already deleted and removes local rows", async () => {
    coreMock.deleteHub.mockRejectedValue(new VpnCoreError(404, "not_found"));

    await service.deleteServer("hub-1");

    expect(repo.deleteServer).toHaveBeenCalledWith("hub-1");
  });

  it("setTenantServers rejects unknown server ids", async () => {
    repo.countExisting.mockResolvedValue(1);

    await expect(
      service.setTenantServers("t1", ["hub-1", "ghost"]),
    ).rejects.toThrow("Server VPN tidak ditemukan");
    expect(repo.replaceTenantServers).not.toHaveBeenCalled();
  });

  it("setTenantServers refuses to revoke a server the tenant's routers use", async () => {
    repo.countExisting.mockResolvedValue(1);
    repo.tenantServerIds.mockResolvedValue(["hub-1", "hub-2"]);
    repo.routersUsing.mockResolvedValue([
      { id: "r1", name: "RB1", tenantName: "Tenant A" },
    ]);

    await expect(
      service.setTenantServers("t1", ["hub-1"]),
    ).rejects.toBeInstanceOf(VpnServerInUseError);
    expect(repo.routersUsing).toHaveBeenCalledWith(["hub-2"], "t1");
    expect(repo.replaceTenantServers).not.toHaveBeenCalled();
  });

  it("setTenantServers replaces the assignment when nothing in use is revoked", async () => {
    repo.countExisting.mockResolvedValue(1);
    repo.tenantServerIds.mockResolvedValue(["hub-2"]);

    await service.setTenantServers("t1", ["hub-1"]);

    expect(repo.replaceTenantServers).toHaveBeenCalledWith("t1", ["hub-1"]);
  });
});

describe("VpnServerRepository.upsertHub protocols", () => {
  async function savedProtocols(h: object) {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const repo = new VpnServerRepository({
      vpnServer: { upsert },
    } as unknown as PrismaClient);
    await repo.upsertHub(h as Parameters<typeof repo.upsertHub>[0]);
    return upsert.mock.calls[0][0].update.protocols;
  }

  it("copies the hub protocols", async () => {
    expect(await savedProtocols(hub)).toEqual(["wireguard", "l2tp"]);
  });

  it("stores a hub from an older core without protocols as wireguard", async () => {
    const { protocols: _omit, ...legacy } = hub;
    expect(await savedProtocols(legacy)).toEqual(["wireguard"]);
  });
});
