import { describe, expect, it } from "vitest";
import {
  buildVpnApiUserScript,
  quoteRouterOs,
} from "@/modules/network/services/vpn-api-user-script";

// The snapshots are provisional until the spike pastes them on a real
// RouterOS v7 router; the `:find` on the `address` array is UNSURE there.

const base = { username: "netmanager-0a1b2c3d", coreAddress: "10.99.0.1" };

describe("quoteRouterOs", () => {
  it("escapes backslash, quote, dollar and question mark, and hex-encodes the rest", () => {
    expect(quoteRouterOs('a\\b"c$d?e')).toBe('"a\\\\b\\"c\\$d\\?e"');
    expect(quoteRouterOs("x\ny\tzé")).toBe('"x\\ny\\tz\\C3\\A9"');
  });
});

describe("buildVpnApiUserScript", () => {
  it("create mode builds group, user and api service access", () => {
    const script = buildVpnApiUserScript({
      ...base,
      password: "pw-abc",
      mode: "create",
    });
    expect(script).toContain('address="10.99.0.1/32"');
    expect(script).toContain('name="netmanager-api"');
    expect(script).toContain("policy=read,write,api,test,policy,sensitive");
    expect(script).toContain(
      "/ip service set [find name=api] disabled=no port=8728",
    );
    expect(script).not.toMatch(/\bremove\b/);
    expect(script).toMatchSnapshot();
  });

  it("quotes the password so it cannot break out of the string", () => {
    const script = buildVpnApiUserScript({
      ...base,
      password: 'p"w\\$x',
      mode: "create",
    });
    expect(script).toContain('password="p\\"w\\\\\\$x"');
  });

  it("only widens an existing api service address, never narrows it", () => {
    const script = buildVpnApiUserScript({
      ...base,
      password: "x",
      mode: "create",
    });
    expect(script).toContain("[:len $nmApiAddr] > 0");
    expect(script).toContain('[:find $nmApiAddr "10.99.0.1/32"]] = 0');
  });

  it("extend mode touches neither group nor password", () => {
    const script = buildVpnApiUserScript({ ...base, mode: "extend" });
    expect(script).not.toContain("/user group");
    expect(script).not.toContain("password");
    expect(script).not.toContain("/user add");
    expect(script).toContain(
      '/user set [find name="netmanager-0a1b2c3d"] address=$nmUserAddr',
    );
    expect(script).not.toMatch(/\bremove\b/);
    expect(script).toMatchSnapshot();
  });
});
