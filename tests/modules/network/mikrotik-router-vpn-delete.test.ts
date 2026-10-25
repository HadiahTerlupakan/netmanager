import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCoreRouter: vi.fn(),
  isConfigured: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => ({ deleteRouter: mocks.deleteCoreRouter }),
  isVpnConfigured: mocks.isConfigured,
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mocks.logError,
    debug: vi.fn(),
  },
  logActivitySafe: vi.fn(),
}));

import { deleteRouterMutation } from "@/modules/network/services/mikrotik-router.mutations";
import { VpnCoreError } from "@/modules/network/vpn/VpnCoreClient";

const TENANT = "t1";
const TUNNEL_IP = "10.100.0.10";

const vpnRouter = {
  id: "r1",
  ipAddress: TUNNEL_IP,
  apiPort: 8728,
  apiUsername: "u",
  apiPassword: "p",
  isolirUrl: null as string | null,
  connectionMode: "VPN",
  vpnCoreRouterId: "core-1",
};

function setup(router: object = vpnRouter) {
  const calls: string[] = [];
  const routerRepository = {
    findById: vi.fn(async () => router),
    delete: vi.fn(async () => {
      calls.push("delete-local");
    }),
  };
  const provisioningService = {
    deprovisionRadius: vi.fn(async () => {
      calls.push("deprovision");
      return { success: true, logs: [] };
    }),
  };
  const tombstoneRepository = { add: vi.fn(async () => {}) };
  const run = () =>
    deleteRouterMutation({
      id: "r1",
      userId: "u1",
      tenantId: TENANT,
      restrictedToOwnSite: false,
      routerRepository,
      networkRepository: { findUserSite: vi.fn() },
      provisioningService,
      tombstoneRepository,
    } as never);
  return {
    calls,
    routerRepository,
    provisioningService,
    tombstoneRepository,
    run,
  };
}

describe("deleteRouterMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VPN_CORE_ADDRESS", "");
    mocks.isConfigured.mockReturnValue(true);
    mocks.deleteCoreRouter.mockImplementation(async () => {});
  });

  it("router VPN: deprovision lewat alamat core, hapus lokal, lalu hapus di core", async () => {
    const t = setup();
    mocks.deleteCoreRouter.mockImplementation(async () => {
      t.calls.push("delete-core");
    });

    await t.run();

    expect(t.calls).toEqual(["deprovision", "delete-local", "delete-core"]);
    expect(t.provisioningService.deprovisionRadius).toHaveBeenCalledWith(
      { ip: TUNNEL_IP, port: 8728, username: "u", password: "p" },
      "10.99.0.1",
    );
    expect(mocks.deleteCoreRouter).toHaveBeenCalledWith("core-1");
    expect(t.tombstoneRepository.add).not.toHaveBeenCalled();
  });

  it("router PUBLIC: deprovision tetap memakai null dan core tidak disentuh", async () => {
    const t = setup({
      ...vpnRouter,
      connectionMode: "PUBLIC",
      vpnCoreRouterId: null,
    });

    await t.run();

    expect(t.provisioningService.deprovisionRadius).toHaveBeenCalledWith(
      expect.objectContaining({ ip: TUNNEL_IP }),
      null,
    );
    expect(mocks.deleteCoreRouter).not.toHaveBeenCalled();
    expect(t.tombstoneRepository.add).not.toHaveBeenCalled();
  });

  it("core error: router lokal tetap terhapus, error di-log dengan id core, tombstone dibuat", async () => {
    mocks.deleteCoreRouter.mockRejectedValue(new VpnCoreError(500, "internal"));
    const t = setup();

    await expect(t.run()).resolves.toBeUndefined();

    expect(t.routerRepository.delete).toHaveBeenCalledWith("r1", TENANT);
    expect(t.tombstoneRepository.add).toHaveBeenCalledWith("core-1");
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("core-1"),
      expect.anything(),
    );
  });

  it("core 404 berarti sudah hilang: tanpa tombstone", async () => {
    mocks.deleteCoreRouter.mockRejectedValue(
      new VpnCoreError(404, "not_found"),
    );
    const t = setup();

    await t.run();

    expect(t.tombstoneRepository.add).not.toHaveBeenCalled();
  });

  it("VPN belum dikonfigurasi: langsung tombstone tanpa memanggil core", async () => {
    mocks.isConfigured.mockReturnValue(false);
    const t = setup();

    await t.run();

    expect(mocks.deleteCoreRouter).not.toHaveBeenCalled();
    expect(t.tombstoneRepository.add).toHaveBeenCalledWith("core-1");
  });

  it("hapus lokal gagal: core tidak dihapus", async () => {
    const t = setup();
    t.routerRepository.delete.mockRejectedValue(new Error("masih dipakai"));

    await expect(t.run()).rejects.toThrow("masih dipakai");

    expect(mocks.deleteCoreRouter).not.toHaveBeenCalled();
    expect(t.tombstoneRepository.add).not.toHaveBeenCalled();
  });
});
