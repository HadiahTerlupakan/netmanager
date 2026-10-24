import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/repositories/NetworkRepository", () => ({
  NetworkRepository: class {
    async findBandwidthById() {
      return { maxLimitDownload: "6M", maxLimitUpload: "4M", priority: 5 };
    }
  },
}));

import { getRateLimitFromBandwidth } from "@/modules/network/services/mikrotik-ppp-profile.bandwidth";
import { buildMikrotikRateLimit } from "@/modules/network/utils/radius-rate-limit";

const max = { maxLimitDownload: "6M", maxLimitUpload: "4M" };

describe("buildMikrotikRateLimit", () => {
  it("menulis semua parameter berurutan upload/download", () => {
    expect(
      buildMikrotikRateLimit({
        ...max,
        burstLimitDownload: "9M",
        burstLimitUpload: "7M",
        burstThresholdDownload: "5M",
        burstThresholdUpload: "3M",
        burstTimeDownload: 12,
        burstTimeUpload: 8,
        priority: 5,
        minLimitDownload: "2M",
        minLimitUpload: "1M",
      }),
    ).toBe("4M/6M 7M/9M 3M/5M 8/12 5 1M/2M");
  });

  it("mengisi posisi burst yang kosong dengan 0/0 agar priority dan min limit tidak bergeser", () => {
    expect(
      buildMikrotikRateLimit({
        ...max,
        priority: 5,
        minLimitDownload: "2M",
        minLimitUpload: "1M",
      }),
    ).toBe("4M/6M 0/0 0/0 0/0 5 1M/2M");
  });

  it("memakai priority 8 bila hanya min limit yang diisi", () => {
    expect(
      buildMikrotikRateLimit({
        ...max,
        minLimitDownload: "2M",
        minLimitUpload: "1M",
      }),
    ).toBe("4M/6M 0/0 0/0 0/0 8 1M/2M");
  });

  it("hanya max limit bila parameter lain kosong", () => {
    expect(buildMikrotikRateLimit(max)).toBe("4M/6M");
  });
});

describe("getRateLimitFromBandwidth", () => {
  it("rate-limit profile PPP juga upload/download dengan posisi terisi", async () => {
    await expect(
      getRateLimitFromBandwidth("profile-1", "bandwidth-1"),
    ).resolves.toBe("4M/6M 0/0 0/0 0/0 5");
  });
});
