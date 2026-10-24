import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectionMode: "RADIUS",
  updatePPPProfileInMikroTik: vi.fn(),
}));

vi.mock("@/modules/network/services/radius-sync-service", () => ({
  RadiusSyncService: class {
    async getConnectionMode() {
      return mocks.connectionMode;
    }
  },
}));
vi.mock("@/modules/network/services/mikrotik-ppp-profile", () => ({
  getRateLimitFromBandwidth: async () => "10M/10M",
  updatePPPProfileInMikroTik: mocks.updatePPPProfileInMikroTik,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { syncMikroTikRateLimit } from "@/modules/network/services/harga-paket.sync";

const paket = {
  id: "paket-1",
  name: "TES-LAB 10M",
  profilePPPId: "profile-1",
  profilePPP: {
    id: "profile-1",
    name: "TES-LAB",
    poolMode: "MIKROTIK",
    mikroTikRouterId: "router-1",
    mikroTikRouter: { id: "router-1" },
  },
};

describe("syncMikroTikRateLimit", () => {
  beforeEach(() => {
    mocks.updatePPPProfileInMikroTik.mockReset();
    mocks.updatePPPProfileInMikroTik.mockResolvedValue({ success: true });
  });

  it("mode RADIUS tidak menyalin bandwidth paket ke profile PPP router", async () => {
    mocks.connectionMode = "RADIUS";

    await syncMikroTikRateLimit(paket);

    expect(mocks.updatePPPProfileInMikroTik).not.toHaveBeenCalled();
  });

  it("mode non-RADIUS tetap menulis rate-limit ke profile PPP router", async () => {
    mocks.connectionMode = "MIKROTIK";

    await syncMikroTikRateLimit(paket);

    expect(mocks.updatePPPProfileInMikroTik).toHaveBeenCalledWith(
      "router-1",
      "TES-LAB",
      { rateLimit: "10M/10M", skipPoolCheck: false },
    );
  });
});
