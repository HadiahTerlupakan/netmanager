import net from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectToMikroTik } from "@/modules/network/services/mikrotik-ip-pool-client";
import { createProvisioningConnection } from "@/modules/network/services/mikrotik-provisioning.connection";
import { MikroTikConnectionFactory } from "@/modules/network/services/mikrotik/MikroTikConnectionFactory";
import { MikroTikConnectionHelper } from "@/modules/network/services/mikrotik/MikroTikConnectionHelper";
import {
  createRouterOsApi,
  toRouterOsTimeoutSeconds,
} from "@/modules/network/services/mikrotik/routeros-timeout";

// A router that accepts the TCP connection and never answers the login, the
// way a firewalled or overloaded RouterOS API port behaves.
let silentRouter: net.Server;
let silentPort: number;
const openSockets = new Set<net.Socket>();

beforeEach(async () => {
  silentRouter = net.createServer((socket) => openSockets.add(socket));
  await new Promise<void>((resolve) =>
    silentRouter.listen(0, "127.0.0.1", resolve),
  );
  silentPort = (silentRouter.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const socket of openSockets) socket.destroy();
  openSockets.clear();
  await new Promise((resolve) => silentRouter.close(resolve));
});

const credentials = { apiUsername: "admin", apiPassword: "x" };

describe("toRouterOsTimeoutSeconds", () => {
  it("converts milliseconds to the whole seconds node-routeros-v2 expects", () => {
    expect(toRouterOsTimeoutSeconds(10_000)).toBe(10);
    expect(toRouterOsTimeoutSeconds(5_000)).toBe(5);
    expect(toRouterOsTimeoutSeconds(1_500)).toBe(2);
  });

  it("never returns 0, which the library would replace with its 10 s default", () => {
    expect(toRouterOsTimeoutSeconds(200)).toBe(1);
  });
});

describe("RouterOS connection timeouts", () => {
  it("connectToMikroTik gives up on a silent router after its timeout", async () => {
    const started = Date.now();
    await expect(
      connectToMikroTik(
        { ipAddress: "127.0.0.1", apiPort: silentPort, ...credentials },
        1_000,
      ),
    ).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(3_000);
  }, 5_000);

  it("MikroTikConnectionFactory gives up on a silent router after 10 s", async () => {
    const started = Date.now();
    await expect(
      new MikroTikConnectionFactory().connect({
        ipAddress: "127.0.0.1",
        apiPort: silentPort,
        ...credentials,
      }),
    ).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(12_000);
  }, 15_000);

  it("provisioning and helper connections carry a 10 s timeout", () => {
    const details = {
      ip: "127.0.0.1",
      port: silentPort,
      username: "admin",
      password: "x",
    };
    expect(createProvisioningConnection(details).timeout).toBe(10);
    expect(
      new MikroTikConnectionHelper().createConnection(details).timeout,
    ).toBe(10);
  });
});

describe("createRouterOsApi", () => {
  // Dengan timeout sungguhan 10 detik, koneksi yang dibiarkan terbuka sedikit
  // terlalu lama memancarkan "error" dari socket setelah login. Tanpa
  // listener, EventEmitter melemparnya dan proses aplikasi mati.
  it("error koneksi setelah login tidak dilempar ke proses", () => {
    const client = createRouterOsApi({
      host: "127.0.0.1",
      port: silentPort,
      user: "admin",
      password: "x",
      timeoutMs: 10_000,
    });

    expect(client.timeout).toBe(10);
    expect(() => client.emit("error", new Error("SOCKTMOUT"))).not.toThrow();
  });
});
