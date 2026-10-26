import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({
  connectRouterById: vi.fn(),
  verifyProfileUpdate: vi.fn(),
}));

vi.mock(
  "@/modules/network/services/mikrotik-ppp-profile.lifecycle",
  async (importActual) => ({
    ...(await importActual<object>()),
    ...lifecycle,
  }),
);

import { updatePPPProfileInMikroTik } from "@/modules/network/services/mikrotik-ppp-profile.create-update";

const TIME_KEYS = ["session-timeout", "idle-timeout"];

// Meniru RouterOS 7: dns-server boleh di-set kosong, tetapi timeout kosong
// ditolak ("invalid time value") dan hanya bisa dihapus lewat unset.
function fakeRouter(profile: Record<string, string>) {
  const row: Record<string, string> = { ".id": "*1", ...profile };
  const write = vi.fn(async (path: string, args: string[] = []) => {
    if (path === "/ppp/profile/print") return [row];
    if (path === "/ppp/profile/set") {
      for (const arg of args.slice(1)) {
        const split = arg.indexOf("=", 1);
        const key = arg.slice(1, split);
        const value = arg.slice(split + 1);
        if (TIME_KEYS.includes(key) && value === "") {
          throw new Error(`invalid time value for argument ${key}`);
        }
        if (value === "") delete row[key];
        else row[key] = value;
      }
    }
    if (path === "/ppp/profile/unset") {
      delete row[args[1].slice("=value-name=".length)];
    }
    return [];
  });
  return { row, conn: { write, close: vi.fn() } };
}

describe("updatePPPProfileInMikroTik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle.verifyProfileUpdate.mockResolvedValue({
      success: true,
      profile: {},
    });
  });

  it("DNS dan timeout yang dikosongkan terhapus dari profile router", async () => {
    const router = fakeRouter({
      name: "TES-LAB",
      "dns-server": "1.1.1.1",
      "session-timeout": "1h",
      "idle-timeout": "10m",
    });
    lifecycle.connectRouterById.mockResolvedValue({
      success: true,
      conn: router.conn,
    });

    const result = await updatePPPProfileInMikroTik("router-1", "TES-LAB", {
      name: "TES-LAB",
      dnsServer: null,
      sessionTimeout: null,
      idleTimeout: null,
    });

    expect(result).toEqual({ success: true });
    expect(router.row).not.toHaveProperty("dns-server");
    expect(router.row).not.toHaveProperty("session-timeout");
    expect(router.row).not.toHaveProperty("idle-timeout");
  });

  it("timeout yang memang kosong di router tidak di-unset lagi", async () => {
    const router = fakeRouter({ name: "TES-LAB" });
    lifecycle.connectRouterById.mockResolvedValue({
      success: true,
      conn: router.conn,
    });

    await updatePPPProfileInMikroTik("router-1", "TES-LAB", {
      name: "TES-LAB",
      sessionTimeout: null,
      idleTimeout: null,
    });

    expect(
      router.conn.write.mock.calls.some(([path]) => path.endsWith("/unset")),
    ).toBe(false);
  });

  it("timeout berisi tetap ditulis", async () => {
    const router = fakeRouter({ name: "TES-LAB" });
    lifecycle.connectRouterById.mockResolvedValue({
      success: true,
      conn: router.conn,
    });

    await updatePPPProfileInMikroTik("router-1", "TES-LAB", {
      name: "TES-LAB",
      sessionTimeout: 3600,
      idleTimeout: 600,
    });

    expect(router.row).toMatchObject({
      "session-timeout": "3600",
      "idle-timeout": "600",
    });
  });
});
