import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouterOSAPI } from "node-routeros-v2";

const fakeConn = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
}));

vi.mock(
  "@/modules/network/services/mikrotik-provisioning.connection",
  async (importActual) => ({
    ...(await importActual<object>()),
    createProvisioningConnection: () => fakeConn,
  }),
);

import {
  setPeerEndpoint,
  setSwitchScript,
  withVpnRouterConnection,
} from "@/modules/network/services/mikrotik-vpn-routeros";
import { VPN_ROUTEROS_OP_TIMEOUT_MS } from "@/modules/network/vpn/constants";
import type { VpnRouterRecord } from "@/modules/network/domain/ports/IMikroTikRouterVpnRepository";

function connection(printRows: unknown[]) {
  const write = vi.fn(async (command: string) =>
    command.endsWith("/print") ? printRows : [],
  );
  return { conn: { write } as unknown as RouterOSAPI, write };
}

describe("mikrotik-vpn-routeros", () => {
  it("replaces the switch script source verbatim", async () => {
    const source = ':global x "a=b"; :put [/system identity get name]\n';
    const { conn, write } = connection([{ ".id": "*7" }]);

    await setSwitchScript(conn, source);

    expect(write).toHaveBeenNthCalledWith(1, "/system/script/print", [
      "?name=netmanager-vpn-switch",
    ]);
    expect(write).toHaveBeenNthCalledWith(2, "/system/script/set", [
      "=.id=*7",
      `=source=${source}`,
    ]);
  });

  it("fails clearly when the switch script is missing", async () => {
    const { conn, write } = connection([]);

    await expect(setSwitchScript(conn, "x")).rejects.toThrow(
      "Skrip netmanager-vpn-switch tidak ada di router",
    );
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("points the netmanager-vpn peer at a new endpoint", async () => {
    const { conn, write } = connection([{ ".id": "*2" }]);

    await setPeerEndpoint(conn, {
      host: "a.example.com",
      port: 51820,
      publicKey: "key-a=",
    });

    expect(write).toHaveBeenNthCalledWith(
      1,
      "/interface/wireguard/peers/print",
      ["?interface=netmanager-vpn"],
    );
    expect(write).toHaveBeenNthCalledWith(2, "/interface/wireguard/peers/set", [
      "=.id=*2",
      "=endpoint-address=a.example.com",
      "=endpoint-port=51820",
      "=public-key=key-a=",
    ]);
  });

  it("fails clearly when the peer is missing", async () => {
    const { conn } = connection([]);

    await expect(
      setPeerEndpoint(conn, { host: "h", port: 1, publicKey: "k" }),
    ).rejects.toThrow("Peer WireGuard pada netmanager-vpn tidak ada di router");
  });
});

const ROUTER: VpnRouterRecord = {
  id: "router-1",
  connectionMode: "VPN",
  vpnCoreRouterId: "core-1",
  vpnActiveServerId: null,
  vpnScriptStale: true,
  ipAddress: "10.100.0.10",
  apiPort: 8728,
  apiUsername: "u",
  apiPassword: "p",
  apiUsernameGenerated: null,
  apiPasswordGenerated: null,
};

describe("withVpnRouterConnection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rejects and closes the connection when the operation never finishes", async () => {
    vi.useFakeTimers();
    fakeConn.connect.mockResolvedValue(undefined);
    fakeConn.close.mockResolvedValue(undefined);

    const result = withVpnRouterConnection(ROUTER, () => new Promise(() => {}));
    const assertion = expect(result).rejects.toThrow(
      `Operasi RouterOS melebihi ${VPN_ROUTEROS_OP_TIMEOUT_MS} ms`,
    );
    await vi.advanceTimersByTimeAsync(VPN_ROUTEROS_OP_TIMEOUT_MS);

    await assertion;
    expect(fakeConn.close).toHaveBeenCalled();
  });

  it("never runs the operation when the connect finishes after the bound", async () => {
    vi.useFakeTimers();
    let finishConnect!: () => void;
    fakeConn.connect.mockReturnValue(
      new Promise<void>((resolve) => (finishConnect = resolve)),
    );
    fakeConn.close.mockResolvedValue(undefined);
    const operation = vi.fn(async () => "written");

    const result = withVpnRouterConnection(ROUTER, operation);
    const assertion = expect(result).rejects.toThrow("Operasi RouterOS");
    await vi.advanceTimersByTimeAsync(VPN_ROUTEROS_OP_TIMEOUT_MS);
    await assertion;
    finishConnect();
    await vi.advanceTimersByTimeAsync(0);

    expect(operation).not.toHaveBeenCalled();
  });

  it("returns the operation's result and closes the connection", async () => {
    fakeConn.connect.mockResolvedValue(undefined);
    fakeConn.close.mockResolvedValue(undefined);

    await expect(
      withVpnRouterConnection(ROUTER, async () => "written"),
    ).resolves.toBe("written");
    expect(fakeConn.close).toHaveBeenCalled();
  });
});
