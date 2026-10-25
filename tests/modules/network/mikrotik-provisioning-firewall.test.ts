import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import type { IsolirProvisioning } from "@/modules/network/isolir/isolir-provisioning";
import {
  provisionFirewallBypass,
  removeFirewallBypass,
} from "@/modules/network/services/mikrotik-provisioning.firewall";

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
    if (path === "/ip/firewall/filter/remove") {
      const id = args[0].slice("=.id=".length);
      filter.splice(
        filter.findIndex((r) => r[".id"] === id),
        1,
      );
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

  // Target dst-nat layanan dan IP server RADIUS berasal dari sumber berbeda;
  // bila berbeda, rule forward menolak trafik ke layanan tanpa entri ini.
  it.each([
    ["berbeda", "10.50.0.1", ["10.99.0.1", "10.50.0.1"]],
    ["sama", "10.99.0.1", ["10.99.0.1"]],
  ])(
    "mode ISOLIR_SERVICE memasukkan alamat layanan (%s dengan IP server)",
    async (_case, address, expected) => {
      const router = fakeRouter();

      await provision(router, { mode: "ISOLIR_SERVICE", address });

      expect(router.allow.map((r) => [r.address, r.comment])).toEqual(
        expected.map((ip) => [ip, `accept.${ip}`]),
      );
    },
  );

  it("mode ISOLIR_SERVICE tidak membuang alamat layanan saat dijalankan ulang", async () => {
    const service: IsolirProvisioning = {
      mode: "ISOLIR_SERVICE",
      address: "10.50.0.1",
    };
    const router = fakeRouter();
    await provision(router, service);
    router.write.mockClear();

    await provision(router, service);

    expect(calls(router, "/ip/firewall/address-list/remove")).toEqual([]);
    expect(calls(router, "/ip/firewall/address-list/add")).toEqual([]);
  });

  const allowRow = (id: string, address: string, extra: Partial<Row> = {}) =>
    ({ ".id": id, list: "netmanager_allow", address, ...extra }) as Row;

  it("hanya menghapus host isolir lama; entri IP, operator, dan dinamis tetap", async () => {
    const router = fakeRouter(
      [],
      [
        allowRow("*1", "10.99.0.1", { comment: "accept.10.99.0.1" }),
        allowRow("*2", "isolir.lama.id", { comment: "accept.isolir.lama.id" }),
        allowRow("*3", "203.0.113.5", { comment: "accept.203.0.113.5" }),
        allowRow("*4", "198.51.100.0/24", { comment: "NOC kantor" }),
        allowRow("*5", "noc.operator.id", { comment: "NOC cadangan" }),
        allowRow("*6", "isolir.dns.id", {
          comment: "accept.isolir.dns.id",
          dynamic: "true",
        }),
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

  it("migrasi VPN memasang IP tunnel tanpa membuang IP billing publik", async () => {
    // Saat migrasi PUBLIC -> VPN provisionRadius dipanggil dengan IP tunnel;
    // IP publik lama masih dipakai input-bypass sampai migrasi selesai atau
    // dibatalkan.
    const router = fakeRouter(
      [],
      [allowRow("*1", "203.0.113.5", { comment: "accept.203.0.113.5" })],
    );

    await provision(router);

    expect(calls(router, "/ip/firewall/address-list/remove")).toEqual([]);
    expect(router.allow.map((r) => r.address)).toEqual([
      "203.0.113.5",
      "10.99.0.1",
    ]);
  });

  it("deprovision membuang seluruh entri statis netmanager_allow", async () => {
    const router = fakeRouter(
      [],
      [
        allowRow("*1", "203.0.113.5", { comment: "accept.203.0.113.5" }),
        allowRow("*2", "isolir.lama.id", { comment: "accept.isolir.lama.id" }),
        allowRow("*3", "isolir.dns.id", { dynamic: "true" }),
      ],
    );

    await removeFirewallBypass({
      connection: router as unknown as RouterOSAPI,
      logs: [],
    });

    expect(calls(router, "/ip/firewall/address-list/remove")).toEqual([
      ["=.id=*1"],
      ["=.id=*2"],
    ]);
  });

  const guardArgs = [
    "=chain=input",
    "=action=drop",
    "=protocol=tcp",
    "=dst-port=8181",
    "=src-address=!10.127.0.0/18",
  ];

  it("menutup port web proxy 8181 dari luar jaringan isolir", async () => {
    const router = fakeRouter();

    await provision(router);

    const guard = calls(router, "/ip/firewall/filter/add").find((args) =>
      args?.includes("=comment=netmanager-proxy-guard"),
    );
    expect(guard).toEqual(expect.arrayContaining(guardArgs));
  });

  it("mengembalikan proxy guard yang dinonaktifkan", async () => {
    const router = fakeRouter();
    await provision(router);
    const guard = router.filter.find(
      (r) => r.comment === "netmanager-proxy-guard",
    )!;
    guard.disabled = "true";
    router.write.mockClear();

    await provision(router);

    expect(calls(router, "/ip/firewall/filter/set")).toEqual([
      [`=.id=${guard[".id"]}`, ...guardArgs, "=disabled=no"],
    ]);
  });

  // Guard baru dibuang provisioning setelah web proxy terbukti mati; run yang
  // putus sebelum itu tidak boleh meninggalkan proxy menyala tanpa guard.
  it("mode ISOLIR_SERVICE tetap memasang dan memulihkan proxy guard", async () => {
    const service: IsolirProvisioning = {
      mode: "ISOLIR_SERVICE",
      address: "10.50.0.1",
    };
    const router = fakeRouter();
    await provision(router, service);
    const guard = router.filter.find(
      (r) => r.comment === "netmanager-proxy-guard",
    )!;
    expect(guard).toEqual(expect.objectContaining(toProps(guardArgs)));

    guard.disabled = "true";
    router.write.mockClear();
    await provision(router, service);

    expect(calls(router, "/ip/firewall/filter/set")).toEqual([
      [`=.id=${guard[".id"]}`, ...guardArgs, "=disabled=no"],
    ]);
    expect(calls(router, "/ip/firewall/filter/remove")).toEqual([]);
  });

  it("deprovision menghapus proxy guard bersama rule billing lain", async () => {
    const router = fakeRouter();
    await provision(router);

    await removeFirewallBypass({
      connection: router as unknown as RouterOSAPI,
      logs: [],
    });

    expect(router.filter).toEqual([]);
  });

  it("deprovision mempertahankan proxy guard bila web proxy masih menyala", async () => {
    const router = fakeRouter();
    await provision(router);

    await removeFirewallBypass({
      connection: router as unknown as RouterOSAPI,
      logs: [],
      keepProxyGuard: true,
    });

    expect(router.filter.map((r) => r.comment)).toEqual([
      "netmanager-proxy-guard",
    ]);
  });
});
