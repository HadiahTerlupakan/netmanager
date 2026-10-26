import { beforeEach, describe, expect, it, vi } from "vitest";

const routerFns = vi.hoisted(() => ({
  updatePPPProfileInMikroTik: vi.fn(),
  createPPPProfileInMikroTik: vi.fn(),
  getRateLimitFromBandwidth: vi.fn(),
}));

vi.mock("@/modules/network/services/mikrotik-ppp-profile", () => routerFns);

import { syncMikroTikProfileOnUpdate } from "@/modules/network/services/profile-ppp-mikrotik-sync";

const OLD_PROFILE = {
  name: "TES-LAB",
  tenantId: "tenant-1",
  siteId: null,
  mikroTikRouter: { id: "router-1" },
} as never;

// Operator mengosongkan DNS dan timeout yang sebelumnya terisi. null (bukan
// field yang dihilangkan) yang membuat updatePPPProfileInMikroTik menghapusnya.
const CLEARED = {
  name: "TES-LAB",
  localAddress: "172.31.250.1",
  remoteAddress: "TES-LAB",
  dnsServer: null,
  sessionTimeout: null,
  idleTimeout: null,
  mikroTikRouterId: "router-1",
} as never;

function modeResolver(mode: string) {
  return async () => ({ getConnectionMode: async () => mode });
}

function sentPayload() {
  return routerFns.updatePPPProfileInMikroTik.mock.calls[0][2];
}

describe("syncMikroTikProfileOnUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerFns.getRateLimitFromBandwidth.mockResolvedValue(null);
  });

  it("field yang dikosongkan ikut dikosongkan di router yang ditugaskan", async () => {
    await syncMikroTikProfileOnUpdate({
      repository: {} as never,
      getRadiusSyncService: modeResolver("MIKROTIK"),
      oldProfile: OLD_PROFILE,
      profilePPP: OLD_PROFILE,
      data: CLEARED,
    });

    expect(sentPayload()).toMatchObject({
      dnsServer: null,
      sessionTimeout: null,
      idleTimeout: null,
    });
  });

  it("mode RADIUS: field yang dikosongkan ikut dikosongkan di semua router", async () => {
    await syncMikroTikProfileOnUpdate({
      repository: {
        findRoutersForProfileBroadcast: async () => [
          { id: "router-1", name: "R1" },
        ],
      } as never,
      getRadiusSyncService: modeResolver("RADIUS"),
      oldProfile: OLD_PROFILE,
      profilePPP: OLD_PROFILE,
      data: CLEARED,
    });

    expect(sentPayload()).toMatchObject({
      dnsServer: null,
      sessionTimeout: null,
      idleTimeout: null,
    });
  });
});
