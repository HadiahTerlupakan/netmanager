import { describe, expect, it } from "vitest";
import { fromCoreProtocol, toCoreProtocol } from "@/modules/network/vpn";

describe("protocol mapping", () => {
  it("round-trips both protocols", () => {
    expect(toCoreProtocol("WIREGUARD")).toBe("wireguard");
    expect(toCoreProtocol("L2TP")).toBe("l2tp");
    expect(fromCoreProtocol(toCoreProtocol("L2TP"))).toBe("L2TP");
    expect(fromCoreProtocol(toCoreProtocol("WIREGUARD"))).toBe("WIREGUARD");
  });

  it("reads a missing protocol from an older core as WireGuard", () => {
    expect(fromCoreProtocol(undefined as never)).toBe("WIREGUARD");
  });
});
