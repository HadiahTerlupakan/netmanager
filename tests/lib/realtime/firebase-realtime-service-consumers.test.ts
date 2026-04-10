import { beforeEach, describe, expect, it, vi } from "vitest";

const existsMock = vi.fn();
const onceMock = vi.fn();
const refMock = vi.fn(() => ({ once: onceMock }));

const buildExpectedConsumerPath = (scopeId: string) =>
  `presence/scopes/${encodeURIComponent(`admin:${scopeId}`)}/consumers`;

vi.mock("@/lib/firebase/admin", () => ({
  db: null,
  realtimeDb: {
    ref: refMock,
  },
  messaging: null,
}));

describe("FirebaseRealtimeService active scope consumers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the realtime scope has active consumer records", async () => {
    existsMock.mockReturnValue(true);
    onceMock.mockResolvedValue({ exists: existsMock });

    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await expect(
      firebaseRealtimeService.hasActiveScopeConsumers({
        kind: "admin",
        id: "mikrotik",
      }),
    ).resolves.toBe(true);
    expect(refMock).toHaveBeenCalledWith(buildExpectedConsumerPath("mikrotik"));
  });

  it("returns false when the realtime scope has no active consumer records", async () => {
    existsMock.mockReturnValue(false);
    onceMock.mockResolvedValue({ exists: existsMock });

    const { firebaseRealtimeService } = await import("@/lib/realtime");

    await expect(
      firebaseRealtimeService.hasActiveScopeConsumers({
        kind: "admin",
        id: "radius:tenant-1",
      }),
    ).resolves.toBe(false);
  });
});
