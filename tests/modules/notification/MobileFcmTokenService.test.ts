import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateMobileFcmToken } from "@/modules/notification/services/MobileFcmTokenService";
import type { IPushTokenRepository } from "@/modules/notification/domain/ports/IPushTokenRepository";

const repository = {
  findOwnerTokens: vi.fn(),
  appendOwnerToken: vi.fn(),
  replaceOwnerTokens: vi.fn(),
} as unknown as IPushTokenRepository;

describe("updateMobileFcmToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a token for regular mobile users", async () => {
    vi.mocked(repository.findOwnerTokens).mockResolvedValue({
      id: "user-1",
      fcmTokens: [],
    });

    await expect(
      updateMobileFcmToken({
        session: { userId: "user-1", tenantId: "tenant-1", role: "ADMIN" },
        fcmToken: "fcm-token-1",
        action: "add",
        repository,
      }),
    ).resolves.toEqual({ message: "FCM token berhasil disimpan" });

    expect(repository.findOwnerTokens).toHaveBeenCalledWith(
      { userId: "user-1", tenantId: "tenant-1", role: "ADMIN" },
      "user-1",
    );
    expect(repository.appendOwnerToken).toHaveBeenCalledWith(
      { userId: "user-1", tenantId: "tenant-1", role: "ADMIN" },
      "user-1",
      "fcm-token-1",
    );
  });

  it("removes a token from mitra records", async () => {
    vi.mocked(repository.findOwnerTokens).mockResolvedValue({
      id: "mitra-1",
      fcmTokens: ["a", "b"],
    });

    await expect(
      updateMobileFcmToken({
        session: { userId: "mitra-1", tenantId: "tenant-1", role: "MITRA" },
        fcmToken: "a",
        action: "remove",
        repository,
      }),
    ).resolves.toEqual({ message: "FCM token berhasil dihapus" });

    expect(repository.replaceOwnerTokens).toHaveBeenCalledWith(
      { userId: "mitra-1", tenantId: "tenant-1", role: "MITRA" },
      "mitra-1",
      ["b"],
    );
  });
});
