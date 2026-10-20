import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRouter: vi.fn(),
  testApi: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => ({ getRouter: mocks.getRouter }),
}));
vi.mock("@/modules/network/services/mikrotik/router-api-test", () => ({
  testMikroTikAPI: mocks.testApi,
}));
vi.mock(
  "@/modules/network/services/mikrotik-router.activity",
  async (importActual) => ({
    ...(await importActual<object>()),
    logRouterUpdateActivity: vi.fn(),
  }),
);

import { updateRouterMutation } from "@/modules/network/services/mikrotik-router.mutations";
import { testRouterConnection } from "@/modules/network/services/mikrotik-router.connection-test";
import { isVpnOverlayAddress } from "@/modules/network/vpn/overlay";
import { VpnRouterInvalidError } from "@/modules/network/vpn/errors";

const VPN_ROUTER = {
  id: "router-1",
  connectionMode: "VPN" as const,
  ipAddress: "10.100.0.10",
  apiPort: 8728,
  apiUsername: "netmanager-0a1b2c3d",
  apiPassword: "p".repeat(32),
};

function runUpdate(router: object, data: object) {
  const routerRepository = {
    findById: vi.fn().mockResolvedValue(router),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const networkRepository = {
    findSettingByKey: vi.fn().mockResolvedValue({ value: "secret" }),
    findUserSite: vi.fn(),
  };
  const done = updateRouterMutation({
    id: "router-1",
    data: data as never,
    userId: "u1",
    tenantId: "t1",
    restrictedToOwnSite: false,
    routerRepository: routerRepository as never,
    networkRepository: networkRepository as never,
  });
  return { done, routerRepository };
}

describe("isVpnOverlayAddress", () => {
  it.each([
    ["10.99.0.1", true],
    ["10.99.255.254", true],
    ["10.100.0.10", true],
    ["10.103.255.255", true],
    ["10.104.0.0", false],
    ["10.98.255.255", false],
    ["203.0.113.9", false],
    ["bukan-ip", false],
  ])("%s → %s", (ip, expected) => {
    expect(isVpnOverlayAddress(ip)).toBe(expected);
  });
});

describe("updateRouterMutation router VPN", () => {
  it.each([
    ["ipAddress", { ipAddress: "203.0.113.9" }],
    ["apiPort", { apiPort: 8729 }],
    ["apiUsername", { apiUsername: "admin" }],
    ["apiPassword", { apiPassword: "lain" }],
  ])("menolak perubahan %s tanpa menulis", async (_field, data) => {
    const { done, routerRepository } = runUpdate(VPN_ROUTER, data);

    await expect(done).rejects.toThrow(
      new VpnRouterInvalidError(
        "Alamat dan kredensial router VPN dikelola otomatis",
      ),
    );
    expect(routerRepository.update).not.toHaveBeenCalled();
  });

  it("menerima nilai yang sama agar form edit tetap bisa menyimpan", async () => {
    const { done, routerRepository } = runUpdate(VPN_ROUTER, {
      name: "Router baru",
      ipAddress: VPN_ROUTER.ipAddress,
      apiPort: VPN_ROUTER.apiPort,
      apiUsername: VPN_ROUTER.apiUsername,
      apiPassword: VPN_ROUTER.apiPassword,
    });

    await done;
    expect(routerRepository.update.mock.calls[0][1]).toMatchObject({
      name: "Router baru",
      ipAddress: VPN_ROUTER.ipAddress,
    });
  });
});

describe("updateRouterMutation router publik", () => {
  it("menolak alamat overlay VPN", async () => {
    const { done, routerRepository } = runUpdate(
      { ...VPN_ROUTER, connectionMode: "PUBLIC", ipAddress: "203.0.113.9" },
      { ipAddress: "10.100.0.77" },
    );

    await expect(done).rejects.toThrow("Alamat ini khusus jaringan VPN");
    expect(routerRepository.update).not.toHaveBeenCalled();
  });
});

describe("testRouterConnection alamat overlay", () => {
  const routerRepository = { findById: vi.fn(), update: vi.fn() };
  const body = {
    tenantId: "t1",
    ipAddress: "10.100.0.10",
    apiPort: 8728,
    apiUsername: "netmanager-0a1b2c3d",
    apiPassword: "p".repeat(32),
    routerRepository,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VPN_CORE_API_URL", "http://core");
    vi.stubEnv("VPN_API_TOKEN", "tok");
    mocks.testApi.mockResolvedValue({ success: true, message: "OK" });
  });

  it("menolak alamat overlay tanpa draft, tanpa login API", async () => {
    await expect(testRouterConnection(body)).rejects.toThrow(
      "Alamat ini khusus jaringan VPN",
    );
    expect(mocks.testApi).not.toHaveBeenCalled();
  });

  it("menolak draft milik tenant lain", async () => {
    mocks.getRouter.mockResolvedValue({
      label: "nm:t2",
      address: "10.100.0.10",
    });

    await expect(
      testRouterConnection({ ...body, vpnDraftId: "d1" }),
    ).rejects.toBeInstanceOf(VpnRouterInvalidError);
    expect(mocks.testApi).not.toHaveBeenCalled();
  });

  it("mengizinkan alamat draft milik tenant", async () => {
    mocks.getRouter.mockResolvedValue({
      label: "nm:t1",
      address: "10.100.0.10",
    });

    const result = await testRouterConnection({ ...body, vpnDraftId: "d1" });

    expect(result.apiResult.success).toBe(true);
    expect(mocks.getRouter).toHaveBeenCalledWith("d1");
  });

  it("router tersimpan milik tenant memakai alamatnya sendiri tanpa cek draft", async () => {
    routerRepository.findById.mockResolvedValue({
      ...VPN_ROUTER,
      apiUsernameGenerated: null,
      apiPasswordGenerated: null,
    });

    await testRouterConnection({ ...body, routerId: "router-1" });

    expect(mocks.getRouter).not.toHaveBeenCalled();
    expect(mocks.testApi).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "10.100.0.10" }),
    );
  });
});
