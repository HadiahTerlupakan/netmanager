import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  messaging: null,
}));

// `lib/firebase/messaging` hanya memakai clearStaleFcmTokens dari barrel
// notifikasi; barrel lengkapnya menarik graf seluruh aplikasi (±1.300 berkas).
// Dipersempit ke implementasi aslinya.
vi.mock("@/modules/notification", async () => ({
  clearStaleFcmTokens: (
    await import("@/modules/notification/services/MobileFcmTokenCleanupService")
  ).clearStaleFcmTokens,
}));

describe("sendFCMNotification fallback", () => {
  it("returns without throwing when firebase messaging is unavailable", async () => {
    const { sendFCMNotification } = await import("@/lib/firebase/messaging");

    await expect(
      sendFCMNotification(["token-1"], "Title", "Body"),
    ).resolves.toBeUndefined();
  });
});
