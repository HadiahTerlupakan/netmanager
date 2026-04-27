import { describe, expect, it, vi } from "vitest";
import { ProfilePPPService } from "@/modules/network";

const repository = {
  findProfilePpps: vi.fn(),
  findProfilePppDetail: vi.fn(),
};

describe("ProfilePPPService read flow", () => {
  it("membangun filter list berdasarkan status dan site restriction", async () => {
    repository.findProfilePpps.mockResolvedValue([{ id: "profile-1" }]);
    const service = new ProfilePPPService(repository as never);

    const result = await service.listProfilePPPs({
      status: "MAINTENANCE",
      siteId: "site-query",
      restriction: { isRestricted: true, siteIds: ["site-1", "site-2"] },
    });

    expect(result).toEqual([{ id: "profile-1" }]);
    expect(repository.findProfilePpps).toHaveBeenCalledWith({
      status: "MAINTENANCE",
      siteIds: ["site-1", "site-2"],
    });
  });
});
