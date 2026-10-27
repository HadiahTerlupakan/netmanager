import type { RouterOSAPI } from "node-routeros-v2";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import type { IsolirProvisioning } from "@/modules/network/isolir/isolir-provisioning";
import {
  provisionFirewallBypass,
  removeFirewallBypass,
} from "@/modules/network/services/mikrotik-provisioning.firewall";

type Row = { ".id": string; [key: string]: string | undefined };

const LIST = "netmanager_isolir_allow";
const PORTAL = "pelanggan.radpro.id";
const SERVICE: IsolirProvisioning = {
  mode: "ISOLIR_SERVICE",
  address: "10.99.0.1",
};

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

function matchesQuery(row: Row, args: string[]) {
  return args
    .filter((a) => a.startsWith("?"))
    .every((a) => {
      const split = a.indexOf("=");
      return row[a.slice(1, split)] === a.slice(split + 1);
    });
}

function insertRow(table: Row[], row: Row, args: string[]) {
  const before = args
    .find((a) => a.startsWith("=place-before="))
    ?.slice("=place-before=".length);
  const index = table.findIndex((r) => r[".id"] === before);
  table.splice(index === -1 ? table.length : index, 0, row);
}

// RouterOS tiruan untuk filter dan address-list: print membaca baris yang
// sudah ditulis, add menghormati place-before, set/remove mengubah baris.
function fakeRouter(filter: Row[] = [], addressList: Row[] = []) {
  const tables: Record<string, Row[]> = {
    "/ip/firewall/filter": filter,
    "/ip/firewall/address-list": addressList,
    "/ip/pool": [],
    "/ppp/profile": [],
  };
  let nextId = 0;
  const write = vi.fn(async (path: string, args: string[] = []) => {
    const split = path.lastIndexOf("/");
    const table = tables[path.slice(0, split)];
    const command = path.slice(split + 1);
    if (!table) return [];
    if (command === "print") return table.filter((r) => matchesQuery(r, args));
    const id = args[0]?.slice("=.id=".length);
    const row = table.find((r) => r[".id"] === id);
    if (command === "add") {
      insertRow(table, { ".id": `*x${nextId++}`, ...toProps(args) }, args);
    }
    if (command === "set" && row) Object.assign(row, toProps(args.slice(1)));
    if (command === "remove" && row) table.splice(table.indexOf(row), 1);
    return [];
  });
  return { write, filter, addressList };
}

function provision(
  router: ReturnType<typeof fakeRouter>,
  isolir: IsolirProvisioning | null = SERVICE,
) {
  return provisionFirewallBypass({
    connection: router as unknown as RouterOSAPI,
    serverIp: "10.99.0.1",
    isolir,
    logs: [],
  });
}

function entries(router: ReturnType<typeof fakeRouter>) {
  return router.addressList
    .filter((r) => r.list === LIST)
    .map((r) => r.address);
}

function filterIndex(router: ReturnType<typeof fakeRouter>, comment: string) {
  return router.filter.findIndex((r) => r.comment === comment);
}

const entry = (id: string, address: string, extra: Partial<Row> = {}): Row => ({
  ".id": id,
  list: LIST,
  address,
  comment: `accept.${address}`,
  ...extra,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("walled garden pelanggan isolir", () => {
  it("berisi alamat isolir core dan nama host portal, terpisah dari netmanager_allow", async () => {
    const router = fakeRouter();

    await provision(router);

    expect(entries(router)).toEqual(["10.99.0.1", PORTAL]);
    expect(
      router.addressList
        .filter((r) => r.list === "netmanager_allow")
        .map((r) => r.address),
    ).toEqual(["10.99.0.1"]);
  });

  it("menurunkan host portal dari DOMAIN", async () => {
    vi.stubEnv("DOMAIN", "contoh.net");
    const router = fakeRouter();

    await provision(router);

    expect(entries(router)).toContain("pelanggan.contoh.net");
  });

  it("mode REDIRECT memasukkan host isolir", async () => {
    const router = fakeRouter();

    await provision(router, { mode: "REDIRECT", target: "isolir.x.id/abc" });

    expect(entries(router)).toEqual(["10.99.0.1", "isolir.x.id", PORTAL]);
  });

  it("menerima trafik isolir ke walled garden di atas rule reject", async () => {
    const router = fakeRouter([{ ".id": "*op", comment: "operator" }]);

    await provision(router);

    const accept =
      router.filter[filterIndex(router, "netmanager-isolir-allow")];
    expect(accept).toMatchObject({
      chain: "forward",
      action: "accept",
      "src-address": "10.127.0.0/18",
      "dst-address-list": LIST,
    });
    const acceptAt = filterIndex(router, "netmanager-isolir-allow");
    for (const reject of ["tcp", "udp", "icmp"]) {
      expect(acceptAt).toBeLessThan(
        filterIndex(router, `netmanager-drop-expired-${reject}`),
      );
    }
  });

  // netmanager_allow adalah sumber akses manajemen router; walled garden
  // tidak boleh pernah membuka chain input.
  it("input-bypass tetap memakai netmanager_allow dan chain input tidak memakai walled garden", async () => {
    const router = fakeRouter();

    await provision(router);

    expect(
      router.filter[filterIndex(router, "netmanager-input-bypass")],
    ).toMatchObject({ chain: "input", "src-address-list": "netmanager_allow" });
    const inputRules = router.filter.filter((r) => r.chain === "input");
    for (const rule of inputRules) {
      expect(Object.values(rule).join(" ")).not.toContain(LIST);
    }
  });

  it("router lama: reject ICMP dipindah ke walled garden, accept disisipkan paling atas", async () => {
    const legacy = fakeRouter();
    await provision(legacy);
    const filter = legacy.filter
      .filter((r) => r.comment !== "netmanager-isolir-allow")
      .map((r) =>
        r.comment === "netmanager-drop-expired-icmp"
          ? { ...r, "dst-address-list": "!netmanager_allow" }
          : r,
      );
    const router = fakeRouter(filter, [
      { ".id": "*a", list: "netmanager_allow", address: "10.99.0.1" },
    ]);

    await provision(router);

    expect(filterIndex(router, "netmanager-isolir-allow")).toBe(0);
    expect(
      router.filter[filterIndex(router, "netmanager-drop-expired-icmp")],
    ).toMatchObject({ "dst-address-list": `!${LIST}` });
    expect(entries(router)).toEqual(["10.99.0.1", PORTAL]);
  });

  it("run kedua tidak menulis apa pun", async () => {
    const router = fakeRouter();
    await provision(router);
    router.write.mockClear();

    await provision(router);

    const writes = router.write.mock.calls.filter(
      ([path]) => !path.endsWith("/print"),
    );
    // Profile isolir memang selalu di-set ulang.
    expect(writes.map(([path]) => path)).toEqual(["/ppp/profile/set"]);
  });

  it("pindah mode membuang host isolir lama milik provisioning, entri operator tetap", async () => {
    const router = fakeRouter(
      [],
      [
        entry("*1", "isolir.lama.id"),
        entry("*2", "bank.contoh.id", { comment: "situs pembayaran" }),
        entry("*3", "203.0.113.9", { dynamic: "true" }),
      ],
    );

    await provision(router);

    expect(entries(router)).toEqual([
      "bank.contoh.id",
      "203.0.113.9",
      "10.99.0.1",
      PORTAL,
    ]);
  });

  it("konfigurasi isolir gagal disusun: entri mode lama dibiarkan", async () => {
    const router = fakeRouter([], [entry("*1", "isolir.lama.id")]);

    await provision(router, null);

    expect(entries(router)).toContain("isolir.lama.id");
    expect(entries(router)).toContain(PORTAL);
  });

  it("deprovision membuang entri statis walled garden dan rule accept-nya", async () => {
    const router = fakeRouter();
    await provision(router);
    router.addressList.push(entry("*dyn", "31.56.30.53", { dynamic: "true" }));

    await removeFirewallBypass({
      connection: router as unknown as RouterOSAPI,
      logs: [],
    });

    expect(entries(router)).toEqual(["31.56.30.53"]);
    expect(filterIndex(router, "netmanager-isolir-allow")).toBe(-1);
  });
});
