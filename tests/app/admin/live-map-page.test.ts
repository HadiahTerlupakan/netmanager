import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnsurePermission = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/rbac", () => ({
  ensurePermission: mockEnsurePermission,
}));

describe("live map page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guards live tracking page with live_tracking:read permission", async () => {
    const liveMapPageModule =
      await import("@/app/admin/kehadiran/live-map/page");

    await liveMapPageModule.default();

    expect(mockEnsurePermission).toHaveBeenCalledWith("live_tracking:read");
  });
});
