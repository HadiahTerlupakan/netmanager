import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import type { IsolirProvisioning } from "@/modules/network/isolir/isolir-provisioning";
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

function queryValue(args: string[], key: string) {
  return args.find((a) => a.startsWith(`?${key}=`))?.slice(key.length + 2);
}

// Holds filter and address-list rows with their properties, so prints see
// what earlier adds wrote; every other print comes back empty.
function fakeRouter(existingFilter: Row[] = [], existingAllow: Row[] = []) {
  const filter = [...existingFilter];
  const allow = [...existingAllow];
  const write = vi.fn(async (path: string, args: string[] = []) => {
    if (path === "/ip/firewall/address-list/print") {
      const address = queryValue(args, "address");
      return allow.filter(
        (r) =>
          r.list === queryValue(args, "list") &&
          (address === undefined || r.address === address),
      );
    }
    if (path === "/ip/firewall/address-list/add") {
      allow.push({ ".id": `*a${allow.length}`, ...toProps(args) });
    }
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
  return { write, filter, allow };
}

const ROUTER_PAGE: IsolirProvisioning = {
  mode: "ROUTER_PAGE",
  html: "<html></html>",
  hash: "h",
};

function provision(
  router: ReturnType<typeof fakeRouter>,
  isolir: IsolirProvisioning = ROUTER_PAGE,
) {
  return provisionFirewallBypass({
    connection: router as unknown as RouterOSAPI,
    serverIp: "10.99.0.1",
    isolir,
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

  it.each([
    ["ROUTER_PAGE", ROUTER_PAGE, ["10.99.0.1"]],
    [
      "REDIRECT",
      { mode: "REDIRECT", target: "isolir.x.id/abc" } as const,
      ["10.99.0.1", "isolir.x.id"],
    ],
  ])(
    "netmanager_allow mode %s berisi IP server dan host isolir hanya untuk REDIRECT",
    async (_mode, isolir, expected) => {
      const router = fakeRouter();

      await provision(router, isolir);

      expect(router.allow.map((r) => r.address)).toEqual(expected);
      expect(router.allow.every((r) => r.list === "netmanager_allow")).toBe(
        true,
      );
    },
  );

  it("menghapus entri netmanager_allow lain, kecuali entri dinamis hasil DNS", async () => {
    const router = fakeRouter(
      [],
      [
        { ".id": "*1", list: "netmanager_allow", address: "10.99.0.1" },
        { ".id": "*2", list: "netmanager_allow", address: "isolir.lama.id" },
        {
          ".id": "*3",
          list: "netmanager_allow",
          address: "203.0.113.9",
          dynamic: "true",
        },
      ],
    );

    await provision(router, { mode: "REDIRECT", target: "isolir.baru.id" });

    expect(calls(router, "/ip/firewall/address-list/remove")).toEqual([
      ["=.id=*2"],
    ]);
    expect(calls(router, "/ip/firewall/address-list/add")).toEqual([
      [
        "=list=netmanager_allow",
        "=address=isolir.baru.id",
        "=comment=accept.isolir.baru.id",
      ],
    ]);
  });
});
