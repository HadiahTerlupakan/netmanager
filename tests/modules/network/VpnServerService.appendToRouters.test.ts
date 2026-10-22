import { beforeEach, describe, expect, it, vi } from "vitest";
import { VpnServerService } from "@/modules/network/services/VpnServerService";
import { VpnServerNotAvailableError } from "@/modules/network/vpn";
import type { IVpnServerRepository } from "@/modules/network/domain/ports/IVpnServerRepository";

const summary = (id: string, status: string) => ({
  id,
  name: id,
  publicHost: "h",
  status,
});

describe("VpnServerService.appendServerToTenantRouters", () => {
  let repo: {
    tenantServers: ReturnType<typeof vi.fn>;
    appendServerToTenantRouters: ReturnType<typeof vi.fn>;
  };
  let service: VpnServerService;

  beforeEach(() => {
    repo = {
      tenantServers: vi.fn().mockResolvedValue([summary("a1", "online")]),
      appendServerToTenantRouters: vi.fn().mockResolvedValue(3),
    };
    service = new VpnServerService(repo as unknown as IVpnServerRepository);
  });

  it("returns the number of routers changed", async () => {
    await expect(
      service.appendServerToTenantRouters("t1", "a1"),
    ).resolves.toEqual({ updated: 3 });
    expect(repo.appendServerToTenantRouters).toHaveBeenCalledWith("t1", "a1");
  });

  it.each([
    ["not assigned to the tenant", [summary("b2", "online")]],
    ["offline", [summary("a1", "offline")]],
  ])("rejects a server that is %s without writing", async (_n, servers) => {
    repo.tenantServers.mockResolvedValue(servers);

    await expect(
      service.appendServerToTenantRouters("t1", "a1"),
    ).rejects.toBeInstanceOf(VpnServerNotAvailableError);
    expect(repo.appendServerToTenantRouters).not.toHaveBeenCalled();
  });
});
