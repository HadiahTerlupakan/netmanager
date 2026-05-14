import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

// --- Mocks (hoisted supaya tersedia saat vi.mock factory dijalankan) ---

const { mockFindMany, mockHandleStatusChange } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockHandleStatusChange: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pelanggan: { findMany: mockFindMany },
  },
}));

vi.mock("@/modules/network/services/radius-sync-service", () => {
  const MockRadiusSyncService = vi.fn(function (this: unknown) {
    (this as Record<string, unknown>).handleStatusChange =
      mockHandleStatusChange;
  });
  return { RadiusSyncService: MockRadiusSyncService };
});

import { handleProfilePppUpdated } from "@/modules/network/services/event-handlers/profile-ppp-updated.handler";

// --- Helpers ---

function buildJob(payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName: EVENT_NAMES.PROFILE_PPP_UPDATED,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

const BASE_PAYLOAD = {
  profileId: "pf-1",
  profileName: "Profile-100Mbps",
  bandwidthChanged: true,
  affectedCustomerCount: 3,
};

// --- Tests ---

describe("ProfilePppUpdatedHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleStatusChange.mockResolvedValue(undefined);
  });

  it("skip kalau bandwidthChanged = false", async () => {
    await handleProfilePppUpdated(
      buildJob({ ...BASE_PAYLOAD, bandwidthChanged: false }),
    );

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockHandleStatusChange).not.toHaveBeenCalled();
  });

  it("zero affected customer → return early tanpa memanggil handleStatusChange", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await handleProfilePppUpdated(buildJob(BASE_PAYLOAD));

    expect(mockHandleStatusChange).not.toHaveBeenCalled();
  });

  it("semua affected customer di-resync sequential dengan status AKTIF", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "cust-1", username: "u1" },
      { id: "cust-2", username: "u2" },
      { id: "cust-3", username: "u3" },
    ]);

    await handleProfilePppUpdated(buildJob(BASE_PAYLOAD));

    expect(mockHandleStatusChange).toHaveBeenCalledTimes(3);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "AKTIF");
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-2", "AKTIF");
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-3", "AKTIF");
  });

  it("query prisma menggunakan profileId dan filter status AKTIF", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await handleProfilePppUpdated(buildJob(BASE_PAYLOAD));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hargaPaket: { profilePPPId: "pf-1" },
          status: "AKTIF",
        }),
      }),
    );
  });

  it("partial failure: log error tapi TIDAK throw (cegah re-disconnect pelanggan yang sudah berhasil)", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "cust-1", username: "u1" },
      { id: "cust-2", username: "u2" },
    ]);
    mockHandleStatusChange
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("MikroTik unreachable"));

    // Partial success → TIDAK throw (sebelumnya throw, sekarang log saja)
    await expect(
      handleProfilePppUpdated(buildJob(BASE_PAYLOAD)),
    ).resolves.not.toThrow();
  });

  it("total failure (semua gagal) → throw untuk BullMQ retry", async () => {
    mockFindMany.mockResolvedValueOnce([{ id: "cust-1", username: "u1" }]);
    mockHandleStatusChange.mockRejectedValueOnce(
      new Error("MikroTik unreachable"),
    );

    await expect(
      handleProfilePppUpdated(buildJob(BASE_PAYLOAD)),
    ).rejects.toThrow(/total failure/);
  });

  it("throw kalau profileId bukan string", async () => {
    await expect(
      handleProfilePppUpdated(buildJob({ ...BASE_PAYLOAD, profileId: 123 })),
    ).rejects.toThrow(/profileId/);
  });
});
