import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import type { IsolirProvisioning } from "@/modules/network/isolir/isolir-provisioning";
import {
  provisionNatRules,
  removeNatRules,
} from "@/modules/network/services/mikrotik-provisioning.nat";

type Row = { ".id": string; [key: string]: string | undefined };

// RouterOS menerima yes/no saat menulis tetapi mencetak boolean sebagai
// true/false.
const PRINTED_BOOLEANS: Record<string, string> = { yes: "true", no: "false" };

function toProps(args: string[]) {
  return Object.fromEntries(
    args
      .filter((a) => a.startsWith("=") && !a.startsWith("=place-before="))
      .map((a) => {
        const split = a.indexOf("=", 1);
        const value = a.slice(split + 1);
        return [a.slice(1, split), PRINTED_BOOLEANS[value] ?? value];
      }),
  );
}

// A minimal RouterOS stand-in: prints answer from the rows already added, so
// a second provisioning run sees what the first one wrote.
function fakeRouter(existingNat: Row[] = [], existingMangle: Row[] = []) {
  const nat = [...existingNat];
  const mangle = [...existingMangle];
  const addressList: Row[] = [];
  const tables: Record<string, Row[]> = {
    "/ip/firewall/nat": nat,
    "/ip/firewall/mangle": mangle,
  };
  const write = vi.fn(async (path: string, args: string[] = []) => {
    const query = (key: string) =>
      args.find((a) => a.startsWith(`?${key}=`))?.slice(key.length + 2);
    const split = path.lastIndexOf("/");
    const table = tables[path.slice(0, split)];
    const command = path.slice(split + 1);
    if (table && command === "print") {
      const comment = query("comment");
      return comment ? table.filter((r) => r.comment === comment) : table;
    }
    if (table && command === "add") {
      table.push({
        ".id": `*n${nat.length + mangle.length}`,
        ...toProps(args),
      });
    }
    if (table && command === "set") {
      const id = args[0].slice("=.id=".length);
      Object.assign(
        table.find((r) => r[".id"] === id)!,
        toProps(args.slice(1)),
      );
    }
    if (table && command === "remove") {
      const id = args[0].slice("=.id=".length);
      table.splice(
        table.findIndex((r) => r[".id"] === id),
        1,
      );
    }
    if (path === "/ip/firewall/address-list/print") {
      return addressList.filter((r) => r.address === query("address"));
    }
    if (path === "/ip/firewall/address-list/add") {
      addressList.push({ ".id": `*a${addressList.length}`, ...toProps(args) });
    }
    return [];
  });
  return { write, nat, mangle, addressList };
}

const ROUTER_PAGE: IsolirProvisioning = {
  mode: "ROUTER_PAGE",
  html: "<html></html>",
  hash: "h",
};
const ISOLIR_SERVICE: IsolirProvisioning = {
  mode: "ISOLIR_SERVICE",
  address: "10.99.0.1",
};

function addedNat(router: ReturnType<typeof fakeRouter>) {
  return router.write.mock.calls
    .filter(([path]) => path === "/ip/firewall/nat/add")
    .map(([, args]) => args);
}

describe("provisionNatRules", () => {
  it("memasang redirect isolir paling atas dan masquerade alamat privat", async () => {
    const router = fakeRouter([{ ".id": "*1", comment: "operator nat" }]);

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });

    const [redirect, masquerade] = addedNat(router);
    expect(redirect).toEqual(
      expect.arrayContaining([
        "=chain=dstnat",
        "=action=redirect",
        "=to-ports=8181",
        "=protocol=tcp",
        "=src-address=10.127.0.0/18",
        "=dst-address-list=!netmanager_allow",
        "=dst-port=80,443",
        "=place-before=*1",
      ]),
    );
    expect(masquerade).toEqual(
      expect.arrayContaining([
        "=chain=srcnat",
        "=action=masquerade",
        "=src-address-list=netmanager_private",
        "=dst-address-list=!netmanager_private",
      ]),
    );
    expect(masquerade.some((a) => a.startsWith("=place-before="))).toBe(false);

    const ranges = router.write.mock.calls
      .filter(([path]) => path === "/ip/firewall/address-list/add")
      .map(([, args]) => args.find((a) => a.startsWith("=address=")));
    expect(ranges).toEqual([
      "=address=10.0.0.0/8",
      "=address=172.16.0.0/12",
      "=address=192.168.0.0/16",
      "=address=100.64.0.0/10",
    ]);
  });

  it("tidak menambah aturan ganda saat dijalankan ulang", async () => {
    const router = fakeRouter();

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });
    router.write.mockClear();
    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });

    expect(addedNat(router)).toEqual([]);
    expect(
      router.write.mock.calls.some(
        ([path]) =>
          path === "/ip/firewall/address-list/add" || path.endsWith("/set"),
      ),
    ).toBe(false);
  });

  it("mengembalikan masquerade dan address list yang diubah ke standar", async () => {
    const router = fakeRouter();
    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });
    const masquerade = router.nat.find(
      (r) => r.comment === "netmanager-masquerade",
    )!;
    masquerade["src-address-list"] = "lan";
    const cgnat = router.addressList.find(
      (r) => r.address === "100.64.0.0/10",
    )!;
    cgnat.disabled = "true";
    router.write.mockClear();

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });

    const sets = router.write.mock.calls.filter(([path]) =>
      path.endsWith("/set"),
    );
    expect(sets).toEqual([
      [
        "/ip/firewall/address-list/set",
        [
          `=.id=${cgnat[".id"]}`,
          "=list=netmanager_private",
          "=address=100.64.0.0/10",
          "=disabled=no",
        ],
      ],
      [
        "/ip/firewall/nat/set",
        [
          `=.id=${masquerade[".id"]}`,
          "=chain=srcnat",
          "=action=masquerade",
          "=src-address-list=netmanager_private",
          "=dst-address-list=!netmanager_private",
          "=disabled=no",
        ],
      ],
    ]);
  });
});

function natRule(router: ReturnType<typeof fakeRouter>, comment: string) {
  return router.nat.find((r) => r.comment === comment);
}

function commentsOf(rows: Row[]) {
  return rows.map((r) => r.comment);
}

// Baris yang ditinggalkan provisioning mode ISOLIR_SERVICE sebelumnya.
function serviceModeRows(): { nat: Row[]; mangle: Row[] } {
  return {
    nat: [
      {
        ".id": "*s1",
        comment: "netmanager-masquerade-isolir",
        chain: "srcnat",
        action: "masquerade",
      },
      {
        ".id": "*s2",
        comment: "netmanager-redirect-expired",
        chain: "dstnat",
        action: "dst-nat",
        "to-addresses": "10.99.0.1",
        "to-ports": "30880",
        protocol: "tcp",
        "src-address": "10.127.0.0/18",
        "dst-address-list": "!netmanager_allow",
        "dst-port": "80",
      },
      {
        ".id": "*s3",
        comment: "netmanager-redirect-expired-https",
        chain: "dstnat",
        action: "dst-nat",
      },
    ],
    mangle: [
      { ".id": "*m1", comment: "netmanager-isolir-mss", chain: "forward" },
    ],
  };
}

const ROUTER_PAGE_REDIRECT = {
  chain: "dstnat",
  action: "redirect",
  "to-ports": "8181",
  protocol: "tcp",
  "src-address": "10.127.0.0/18",
  "dst-address-list": "!netmanager_allow",
  "dst-port": "80,443",
};

describe("provisionNatRules mode ISOLIR_SERVICE", () => {
  it("dst-nat HTTP/HTTPS ke servis isolir lewat tunnel, masquerade paling atas, dan clamp MSS", async () => {
    const router = fakeRouter([{ ".id": "*1", comment: "operator nat" }]);

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ISOLIR_SERVICE,
    });

    const added = addedNat(router);
    const byComment = (comment: string) =>
      added.find((args) => args.includes(`=comment=${comment}`))!;
    expect(byComment("netmanager-redirect-expired")).toEqual(
      expect.arrayContaining([
        "=chain=dstnat",
        "=action=dst-nat",
        "=to-addresses=10.99.0.1",
        "=to-ports=30880",
        "=protocol=tcp",
        "=src-address=10.127.0.0/18",
        "=dst-address-list=!netmanager_allow",
        "=dst-port=80",
        "=place-before=*1",
      ]),
    );
    expect(byComment("netmanager-redirect-expired-https")).toEqual(
      expect.arrayContaining([
        "=chain=dstnat",
        "=action=dst-nat",
        "=to-addresses=10.99.0.1",
        "=to-ports=30443",
        "=protocol=tcp",
        "=src-address=10.127.0.0/18",
        "=dst-address-list=!netmanager_allow",
        "=dst-port=443",
        expect.stringMatching(/^=place-before=/),
      ]),
    );
    const masquerade = byComment("netmanager-masquerade-isolir");
    expect(masquerade).toEqual(
      expect.arrayContaining([
        "=chain=srcnat",
        "=action=masquerade",
        "=protocol=tcp",
        "=src-address=10.127.0.0/18",
        "=dst-address=10.99.0.1",
        "=dst-port=30880,30443",
      ]),
    );
    // Paling atas: sebelum rule pertama yang dicetak router saat ditambahkan.
    expect(masquerade).toContain(`=place-before=${router.nat[0][".id"]}`);

    const mangle = router.write.mock.calls
      .filter(([path]) => path === "/ip/firewall/mangle/add")
      .map(([, args]) => args);
    expect(mangle).toEqual([
      [
        "=chain=forward",
        "=action=change-mss",
        "=new-mss=clamp-to-pmtu",
        "=passthrough=yes",
        "=protocol=tcp",
        "=tcp-flags=syn",
        "=src-address=10.127.0.0/18",
        "=dst-address=10.99.0.1",
        "=dst-port=30880,30443",
        "=comment=netmanager-isolir-mss",
      ],
    ]);
    expect(natRule(router, "netmanager-masquerade")).toBeDefined();
  });

  it("dijalankan ulang tidak menambah atau mengubah apa pun", async () => {
    const router = fakeRouter();
    const params = {
      connection: router,
      logs: [] as string[],
      isolir: ISOLIR_SERVICE,
    };
    await provisionNatRules(params);
    router.write.mockClear();

    await provisionNatRules(params);

    expect(
      router.write.mock.calls.filter(
        ([path]) =>
          path.endsWith("/add") ||
          path.endsWith("/set") ||
          path.endsWith("/remove"),
      ),
    ).toEqual([]);
  });

  it("router ROUTER_PAGE yang pindah ke ISOLIR_SERVICE: rule HTTP di-set ke dst-nat", async () => {
    const router = fakeRouter();
    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ISOLIR_SERVICE,
    });

    expect(
      router.nat.filter((r) => r.comment === "netmanager-redirect-expired"),
    ).toHaveLength(1);
    expect(natRule(router, "netmanager-redirect-expired")).toMatchObject({
      action: "dst-nat",
      "to-addresses": "10.99.0.1",
      "to-ports": "30880",
      "dst-port": "80",
    });
  });
});

describe("provisionNatRules saat mode berganti atau tidak diketahui", () => {
  it("ROUTER_PAGE setelah ISOLIR_SERVICE: rule HTTP kembali ke redirect 8181 dan rule servis dihapus", async () => {
    const seeded = serviceModeRows();
    const router = fakeRouter(seeded.nat, seeded.mangle);

    await provisionNatRules({
      connection: router,
      logs: [],
      isolir: ROUTER_PAGE,
    });

    expect(natRule(router, "netmanager-redirect-expired")).toMatchObject({
      ".id": "*s2",
      ...ROUTER_PAGE_REDIRECT,
    });
    expect(commentsOf(router.nat).sort()).toEqual([
      "netmanager-masquerade",
      "netmanager-redirect-expired",
    ]);
    expect(router.mangle).toEqual([]);
  });

  it("isolir null: rule bermode tidak disentuh, masquerade tetap dipastikan", async () => {
    const seeded = serviceModeRows();
    const router = fakeRouter(seeded.nat, seeded.mangle);
    const before = JSON.stringify([router.nat, router.mangle]);

    await provisionNatRules({ connection: router, logs: [], isolir: null });

    const changes = router.write.mock.calls.filter(
      ([path]) =>
        path.startsWith("/ip/firewall/nat/") ||
        path.startsWith("/ip/firewall/mangle/"),
    );
    expect(
      changes
        .filter(([path]) => !path.endsWith("/print"))
        .map(([path, args]) => [path, args.at(-1)]),
    ).toEqual([["/ip/firewall/nat/add", "=comment=netmanager-masquerade"]]);
    expect(JSON.stringify([router.nat.slice(0, -1), router.mangle])).toBe(
      before,
    );
  });
});

describe("removeNatRules", () => {
  it("menghapus rule NAT dan mangle mode servis menurut comment", async () => {
    const seeded = serviceModeRows();
    const router = fakeRouter(
      [{ ".id": "*op", comment: "operator nat" }, ...seeded.nat],
      seeded.mangle,
    );

    await removeNatRules({ connection: router, logs: [] });

    expect(commentsOf(router.nat)).toEqual(["operator nat"]);
    expect(router.mangle).toEqual([]);
  });
});
