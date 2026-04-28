import { describe, expect, it, vi } from "vitest";

const mockCheckSiteRestriction = vi.hoisted(() => vi.fn());

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockCheckSiteRestriction,
}));

import { BandwidthRouteService } from "@/modules/network/services/BandwidthRouteService";
import type { IBandwidthRepository } from "@/modules/network/domain/ports/IBandwidthRepository";

const session = {
  user: { id: "user-1" },
  expires: "2026-04-27T09:00:00.000Z",
};

const bandwidth = {
  id: "bandwidth-1",
  name: "Paket 10M",
  maxLimitDownload: "10M",
  maxLimitUpload: "5M",
  status: "AKTIF",
  siteId: "site-1",
};

function createRepository(): IBandwidthRepository {
  return {
    findMany: vi.fn().mockResolvedValue([bandwidth]),
    create: vi.fn().mockResolvedValue(bandwidth),
    findById: vi.fn(),
    update: vi.fn(),
    findForDelete: vi.fn(),
    delete: vi.fn(),
  };
}

describe("BandwidthRouteService", () => {
  it("mengambil daftar bandwidth melalui repository dengan filter site", async () => {
    mockCheckSiteRestriction.mockReturnValue({
      isRestricted: true,
      siteIds: ["site-1"],
    });
    const repository = createRepository();
    const service = new BandwidthRouteService(repository);

    const result = await service.getBandwidths(
      "http://localhost/api/bandwidth?status=AKTIF&siteId=site-2",
      session,
    );

    expect(repository.findMany).toHaveBeenCalledWith({
      status: "AKTIF",
      siteIds: ["site-1"],
      includeGlobal: true,
    });
    expect(result).toEqual([bandwidth]);
  });
});
