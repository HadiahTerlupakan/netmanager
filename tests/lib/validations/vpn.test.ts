import { describe, expect, it } from "vitest";
import {
  routerVpnEnableSchema,
  tenantVpnServersSchema,
  vpnDraftCreateSchema,
} from "@/lib/validations/vpn";

describe("VPN server id validation", () => {
  it.each([
    ["vpnDraftCreateSchema", vpnDraftCreateSchema],
    ["tenantVpnServersSchema", tenantVpnServersSchema],
  ])("%s rejects a non-hex serverIds element", (_n, schema) => {
    expect(schema.safeParse({ serverIds: ["../a"] }).success).toBe(false);
    expect(schema.safeParse({ serverIds: ["aa", "A1"] }).success).toBe(false);
    expect(schema.safeParse({ serverIds: ["aa01"] }).success).toBe(true);
  });
});

describe("VPN protocol validation", () => {
  it('vpnDraftCreateSchema default WIREGUARD dan menolak "PPTP"', () => {
    const base = { serverIds: ["aa"] };
    expect(vpnDraftCreateSchema.parse(base).protocol).toBe("WIREGUARD");
    expect(
      vpnDraftCreateSchema.parse({ ...base, protocol: "L2TP" }).protocol,
    ).toBe("L2TP");
    expect(
      vpnDraftCreateSchema.safeParse({ ...base, protocol: "PPTP" }).success,
    ).toBe(false);
  });

  it("routerVpnEnableSchema default WIREGUARD dan menerima L2TP", () => {
    const base = { serverIds: ["aa"] };
    expect(routerVpnEnableSchema.parse(base).protocol).toBe("WIREGUARD");
    expect(
      routerVpnEnableSchema.parse({ ...base, protocol: "L2TP" }).protocol,
    ).toBe("L2TP");
  });
});
