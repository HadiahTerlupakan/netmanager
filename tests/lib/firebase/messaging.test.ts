import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  messaging: null,
}));

describe("sendFCMNotification fallback", () => {
  it("returns without throwing when firebase messaging is unavailable", async () => {
    const { sendFCMNotification } = await import("@/lib/firebase/messaging");

    await expect(
      sendFCMNotification(["token-1"], "Title", "Body"),
    ).resolves.toBeUndefined();
  });
});
