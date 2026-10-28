import { describe, expect, it, vi } from "vitest";

// node-routeros-v2 is not safe for concurrent writes on one connection: when
// RouterOS answers several tagged commands in one TCP segment, its receiver
// throws UNREGISTEREDTAG and the pending writes never settle. The fake below
// behaves the same way, so the test fails whenever commands overlap.
const replies: Record<string, unknown[]> = {
  "/system/identity/print": [{ name: "lab" }],
  "/system/resource/print": [
    { version: "7.24.5 (stable)", "board-name": "CHR", uptime: "1d" },
  ],
  "/ppp/active/print": [{}, {}],
};

vi.mock("node-routeros-v2", () => ({
  RouterOSAPI: class {
    // createRouterOsApi memasang listener error pada setiap koneksi.
    on() {
      return this;
    }
    private inFlight = 0;
    connect() {
      return Promise.resolve();
    }
    write(command: string) {
      this.inFlight += 1;
      if (this.inFlight > 1) return new Promise(() => {});
      return new Promise((resolve) =>
        setTimeout(() => {
          this.inFlight -= 1;
          resolve(replies[command]);
        }, 5),
      );
    }
    close() {}
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { testMikroTikAPI } from "@/modules/network/services/mikrotik/router-api-test";

describe("testMikroTikAPI", () => {
  it("membaca info router satu perintah per waktu sehingga tidak macet", async () => {
    const result = await testMikroTikAPI({
      ipAddress: "10.100.0.4",
      port: 8728,
      username: "u",
      password: "p",
      timeout: 200,
    });

    expect(result.success).toBe(true);
    expect(result.routerInfo).toEqual({
      identity: "lab",
      version: "7.24.5 (stable)",
      boardName: "CHR",
      uptime: "1d",
      userOnline: 2,
    });
  });
});
