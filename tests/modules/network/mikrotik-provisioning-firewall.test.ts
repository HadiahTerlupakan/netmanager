import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import { provisionFirewallBypass } from "@/modules/network/services/mikrotik-provisioning.firewall";

type Row = { ".id": string; [key: string]: string | undefined };

function toProps(args: string[]) {
  return Object.fromEntries(
    args
      .filter((a) => a.startsWith("=") && !a.startsWith("=place-before="))
      .map((a) => {
        const split = a.indexOf("=", 1);
        return [a.slice(1, split), a.slice(split + 1)];
      }),
  );
}

// Holds filter rows with their properties, so prints see what earlier adds
// and sets wrote; every other print comes back empty.
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
      filter.push({ ".id": `*f${filter.length}`, ...toProps(args) });
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

function calls(router: ReturnType<typeof fakeRouter>, path: string) {
  return router.write.mock.calls
    .filter(([p]) => p === path)
    .map(([, args]) => args);
}

describe("provisionFirewallBypass", () => {
  it("menolak ICMP dari pelanggan isolir kecuali ke server billing", async () => {
    const router = fakeRouter();

    await provision(router);

    const icmp = calls(router, "/ip/firewall/filter/add").find((args) =>
      args?.includes("=comment=netmanager-drop-expired-icmp"),
    );
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

  it("menjalankan ulang tanpa menambah atau mengubah apa pun", async () => {
    const router = fakeRouter();
    await provision(router);
    router.write.mockClear();

    await provision(router);

    expect(calls(router, "/ip/firewall/filter/add")).toHaveLength(0);
    expect(calls(router, "/ip/firewall/filter/set")).toHaveLength(0);
  });

  it("mengembalikan aturan yang diubah atau dinonaktifkan ke nilai standar", async () => {
    const router = fakeRouter();
    await provision(router);
    const tcp = router.filter.find(
      (r) => r.comment === "netmanager-drop-expired-tcp",
    )!;
    tcp["src-address"] = "10.127.0.0/24";
    const udp = router.filter.find(
      (r) => r.comment === "netmanager-drop-expired-udp",
    )!;
    udp.disabled = "true";
    router.write.mockClear();

    await provision(router);

    expect(calls(router, "/ip/firewall/filter/set")).toEqual([
      [
        `=.id=${tcp[".id"]}`,
        "=chain=forward",
        "=action=reject",
        "=protocol=tcp",
        "=src-address=10.127.0.0/18",
        "=disabled=no",
      ],
      [
        `=.id=${udp[".id"]}`,
        "=chain=forward",
        "=action=reject",
        "=protocol=udp",
        "=src-address=10.127.0.0/18",
        "=dst-port=!53,5353",
        "=disabled=no",
      ],
    ]);
    expect(calls(router, "/ip/firewall/filter/add")).toHaveLength(0);
  });
});
