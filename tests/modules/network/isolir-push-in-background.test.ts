import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/modules/network/isolir/isolir-push", () => ({
  pushIsolirPageToTenantRouters: mocks.push,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

import { pushIsolirPageInBackground } from "@/modules/network/isolir/IsolirPageService";

describe("pushIsolirPageInBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengirim halaman isolir tenant ke router-routernya", async () => {
    mocks.push.mockResolvedValue({});

    pushIsolirPageInBackground("tenant-1");

    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("tenant-1"));
  });

  it.each([null, undefined, ""])(
    "tanpa tenant (%j) tidak mengirim apa pun",
    async (tenantId) => {
      pushIsolirPageInBackground(tenantId);
      await Promise.resolve();

      expect(mocks.push).not.toHaveBeenCalled();
    },
  );

  it("galat pengiriman dicatat, tidak dilempar ke pemanggil", async () => {
    mocks.push.mockRejectedValue(new Error("router mati"));

    expect(() => pushIsolirPageInBackground("tenant-1")).not.toThrow();

    await vi.waitFor(() =>
      expect(mocks.logError).toHaveBeenCalledWith(
        "[isolir] Pengiriman halaman isolir gagal:",
        expect.objectContaining({ message: "router mati" }),
      ),
    );
  });
});
