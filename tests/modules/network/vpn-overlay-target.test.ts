import { describe, expect, it } from "vitest";

import { assertNotVpnOverlayTarget } from "@/modules/network/services/vpn-overlay-target";
import { VpnRouterInvalidError } from "@/modules/network/vpn/errors";

const OVERLAY = "Alamat ini khusus jaringan VPN";

describe("assertNotVpnOverlayTarget", () => {
  it.each([
    ["10.100.0.5", OVERLAY],
    ["10.99.0.1", OVERLAY],
    ["::ffff:10.100.0.5", OVERLAY],
    ["0:0:0:0:0:ffff:a64:5", OVERLAY],
    ["010.100.0.5", "Alamat router tidak valid"],
    ["10.100.5", "Alamat router tidak valid"],
    ["0x0a.0x64.0.5", "Alamat router tidak valid"],
    ["167510021", "Alamat router tidak valid"],
    ["fe80::1%eth0", "Alamat router tidak valid"],
  ])("menolak literal %s", async (host, message) => {
    await expect(assertNotVpnOverlayTarget(host)).rejects.toThrow(
      new VpnRouterInvalidError(message),
    );
  });

  it.each(["203.0.113.9", "2001:db8::1", "::ffff:203.0.113.9"])(
    "mengizinkan IP publik %s",
    async (host) => {
      await expect(assertNotVpnOverlayTarget(host)).resolves.toEqual(
        expect.any(String),
      );
    },
  );

  it("mengembalikan literal IPv4-mapped IPv6 sebagai IPv4", async () => {
    await expect(assertNotVpnOverlayTarget("::ffff:203.0.113.9")).resolves.toBe(
      "203.0.113.9",
    );
  });

  it.each(["router.example.com", "localhost", "tidak-ada.example"])(
    "menolak nama host %s",
    async (host) => {
      await expect(assertNotVpnOverlayTarget(host)).rejects.toThrow(
        new VpnRouterInvalidError(
          "IP Router harus berupa alamat IP, bukan nama host",
        ),
      );
    },
  );
});
