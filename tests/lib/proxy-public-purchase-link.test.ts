import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

/**
 * Halaman link belanja membawa token di fragmen URL. Proxy tidak mengubah
 * aturan login-nya (halaman ini publik di domain utama), hanya menambah
 * header supaya tidak di-cache, tidak diindeks, dan tidak mengirim Referer.
 */
describe("proxy /belanja", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
  });

  async function open(path: string) {
    const { proxy } = await import("@/proxy");
    return proxy(
      new NextRequest(`https://radpro.id${path}`, {
        headers: { host: "radpro.id" },
      }),
    );
  }

  it("tanpa login tetap dibuka, dengan header no-store/noindex/no-referrer", async () => {
    const response = await open("/belanja");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("halaman lain tidak ikut berubah", async () => {
    const response = await open("/belanja-lain");

    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
