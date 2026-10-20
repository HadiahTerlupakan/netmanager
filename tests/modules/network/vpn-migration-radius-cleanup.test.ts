import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import { removeOtherRadiusConfigs } from "@/modules/network/services/mikrotik-provisioning.radius";
import { detectPublicIpWithSource } from "@/modules/network/services/mikrotik-provisioning.ip-detection";

describe("removeOtherRadiusConfigs", () => {
  it("removes every netmanager entry except the one to keep", async () => {
    const connection = {
      write: vi.fn(async (path: string) =>
        path === "/radius/print"
          ? [
              { ".id": "*1", address: "10.99.0.1" },
              { ".id": "*2", address: "203.0.113.5" },
              { ".id": "*3", address: "192.168.1.10" },
            ]
          : [],
      ),
    };

    const removed = await removeOtherRadiusConfigs({
      connection: connection as never,
      keepServerIp: "10.99.0.1",
    });

    expect(removed).toBe(2);
    expect(connection.write.mock.calls).toEqual([
      ["/radius/print", ["?comment=added by netmanager"]],
      ["/radius/remove", ["=.id=*2"]],
      ["/radius/remove", ["=.id=*3"]],
    ]);
  });
});

describe("detectPublicIpWithSource", () => {
  afterEach(() => {
    delete process.env.RADIUS_PUBLIC_IP;
    vi.unstubAllGlobals();
  });

  it("reports the configured address as env", async () => {
    process.env.RADIUS_PUBLIC_IP = "203.0.113.5";

    await expect(detectPublicIpWithSource()).resolves.toEqual({
      ip: "203.0.113.5",
      source: "env",
    });
  });

  it("reports the local-interface fallback as local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(detectPublicIpWithSource()).resolves.toMatchObject({
      source: "local",
    });
  });
});
