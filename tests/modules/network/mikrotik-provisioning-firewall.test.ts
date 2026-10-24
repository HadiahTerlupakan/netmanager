import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import { provisionFirewallBypass } from "@/modules/network/services/mikrotik-provisioning.firewall";

type Row = { ".id": string; comment?: string };

// Prints answer from the filter rows already added, so a rerun sees what an
// earlier run wrote; every other print comes back empty.
function fakeRouter(existingFilter: Row[] = []) {
  const filter = [...existingFilter];
  const write = vi.fn(async (path: string, args: string[] = []) => {
    if (path === "/ip/firewall/filter/print") {
      const comment = args
        .find((a) => a.startsWith("?comment="))
        ?.slice("?comment=".length);
      return comment ? filter.filter((r) => r.comment === comment) : filter;
    }
    if (path === "/ip/firewall/filter/add") {
      const comment = args
        .find((a) => a.startsWith("=comment="))
        ?.slice("=comment=".length);
      filter.push({ ".id": `*f${filter.length}`, comment });
    }
    return [];
  });
  return { write, filter };
}

function provision(router: ReturnType<typeof fakeRouter>) {
  return provisionFirewallBypass({
    connection: router as unknown as RouterOSAPI,
    serverIp: "10.99.0.1",
    logs: [],
  });
}

describe("provisionFirewallBypass", () => {
  it("menolak ICMP dari pelanggan isolir kecuali ke server billing", async () => {
    const router = fakeRouter();

    await provision(router);

    const icmp = router.write.mock.calls.find(
      ([path, args]) =>
        path === "/ip/firewall/filter/add" &&
        args?.includes("=comment=netmanager-drop-expired-icmp"),
    )?.[1];
    expect(icmp).toEqual(
      expect.arrayContaining([
        "=chain=forward",
        "=action=reject",
        "=protocol=icmp",
        "=src-address=10.127.0.0/18",
        "=dst-address-list=!netmanager_allow",
      ]),
    );
  });

  it("router yang sudah diprovisioning hanya mendapat aturan ICMP", async () => {
    const router = fakeRouter([
      { ".id": "*1", comment: "netmanager-input-bypass" },
      { ".id": "*2", comment: "netmanager-forward-bypass" },
      { ".id": "*3", comment: "netmanager-drop-expired-tcp" },
      { ".id": "*4", comment: "netmanager-drop-expired-udp" },
    ]);

    await provision(router);

    expect(router.filter.map((r) => r.comment)).toContain(
      "netmanager-drop-expired-icmp",
    );
    expect(router.filter).toHaveLength(5);
  });
});
