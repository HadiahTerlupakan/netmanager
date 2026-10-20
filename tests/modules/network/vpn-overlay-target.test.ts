import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));

vi.mock("node:dns", () => ({ promises: { lookup: mocks.lookup } }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { assertNotVpnOverlayTarget } from "@/modules/network/services/vpn-overlay-target";
import { VpnRouterInvalidError } from "@/modules/network/vpn/errors";

const OVERLAY = "Alamat ini khusus jaringan VPN";

describe("assertNotVpnOverlayTarget", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["10.100.0.5", OVERLAY],
    ["10.99.0.1", OVERLAY],
    ["::ffff:10.100.0.5", OVERLAY],
    ["0:0:0:0:0:ffff:a64:5", OVERLAY],
    ["010.100.0.5", "Alamat router tidak valid"],
    ["10.100.5", "Alamat router tidak valid"],
    ["0x0a.0x64.0.5", "Alamat router tidak valid"],
    ["167510021", "Alamat router tidak valid"],
  ])("menolak literal %s tanpa DNS", async (host, message) => {
    await expect(assertNotVpnOverlayTarget(host)).rejects.toThrow(
      new VpnRouterInvalidError(message),
    );
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it.each(["203.0.113.9", "2001:db8::1", "::ffff:203.0.113.9"])(
    "mengizinkan IP publik %s",
    async (host) => {
      await expect(assertNotVpnOverlayTarget(host)).resolves.toEqual(
        expect.any(String),
      );
    },
  );

  it("menolak nama host yang salah satu alamatnya di overlay", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "203.0.113.9", family: 4 },
      { address: "::ffff:10.100.0.5", family: 6 },
    ]);

    await expect(
      assertNotVpnOverlayTarget("router.example.com"),
    ).rejects.toThrow(OVERLAY);
    expect(mocks.lookup).toHaveBeenCalledWith("router.example.com", {
      all: true,
    });
  });

  it("mengizinkan nama host yang resolve ke IP publik", async () => {
    mocks.lookup.mockResolvedValue([{ address: "203.0.113.9", family: 4 }]);

    await expect(assertNotVpnOverlayTarget("router.example.com")).resolves.toBe(
      "203.0.113.9",
    );
  });

  it("mengembalikan literal IPv4-mapped IPv6 sebagai IPv4", async () => {
    await expect(assertNotVpnOverlayTarget("::ffff:203.0.113.9")).resolves.toBe(
      "203.0.113.9",
    );
  });

  it("menolak nama host yang gagal di-resolve", async () => {
    mocks.lookup.mockRejectedValue(
      Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }),
    );

    await expect(
      assertNotVpnOverlayTarget("tidak-ada.example"),
    ).rejects.toThrow("Alamat router tidak dapat diverifikasi");
  });
});
