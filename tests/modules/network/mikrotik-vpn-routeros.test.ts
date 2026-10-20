import { describe, expect, it, vi } from "vitest";
import type { RouterOSAPI } from "node-routeros-v2";
import {
  setPeerEndpoint,
  setSwitchScript,
} from "@/modules/network/services/mikrotik-vpn-routeros";

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
