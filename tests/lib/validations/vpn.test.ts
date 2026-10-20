import { describe, expect, it } from "vitest";
import {
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
