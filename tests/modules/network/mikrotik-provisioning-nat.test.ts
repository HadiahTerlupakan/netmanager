import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import { provisionNatRules } from "@/modules/network/services/mikrotik-provisioning.nat";

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

// A minimal RouterOS stand-in: prints answer from the rows already added, so
// a second provisioning run sees what the first one wrote.
function fakeRouter(existingNat: Row[] = []) {
  const nat = [...existingNat];
  const addressList: Row[] = [];
  const write = vi.fn(async (path: string, args: string[] = []) => {
    const query = (key: string) =>
      args.find((a) => a.startsWith(`?${key}=`))?.slice(key.length + 2);
    if (path === "/ip/firewall/nat/print") {
      const comment = query("comment");
      return comment ? nat.filter((r) => r.comment === comment) : nat;
    }
    if (path === "/ip/firewall/address-list/print") {
      return addressList.filter((r) => r.address === query("address"));
    }
    if (path === "/ip/firewall/nat/add") {
      nat.push({ ".id": `*n${nat.length}`, ...toProps(args) });
    }
    if (path === "/ip/firewall/address-list/add") {
      addressList.push({ ".id": `*a${addressList.length}`, ...toProps(args) });
    }
    return [];
  });
  return { write, nat, addressList };
}

function addedNat(router: ReturnType<typeof fakeRouter>) {
  return router.write.mock.calls
    .filter(([path]) => path === "/ip/firewall/nat/add")
    .map(([, args]) => args);
}

describe("provisionNatRules", () => {
  it("memasang redirect isolir paling atas dan masquerade alamat privat", async () => {
    const router = fakeRouter([{ ".id": "*1", comment: "operator nat" }]);

    await provisionNatRules({ connection: router, logs: [] });

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

    await provisionNatRules({ connection: router, logs: [] });
    router.write.mockClear();
    await provisionNatRules({ connection: router, logs: [] });

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
    await provisionNatRules({ connection: router, logs: [] });
    const masquerade = router.nat.find(
      (r) => r.comment === "netmanager-masquerade",
    )!;
    masquerade["src-address-list"] = "lan";
    const cgnat = router.addressList.find(
      (r) => r.address === "100.64.0.0/10",
    )!;
    cgnat.disabled = "true";
    router.write.mockClear();

    await provisionNatRules({ connection: router, logs: [] });

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
