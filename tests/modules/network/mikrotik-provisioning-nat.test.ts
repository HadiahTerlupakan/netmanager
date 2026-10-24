import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));

import { provisionNatRules } from "@/modules/network/services/mikrotik-provisioning.nat";

type Row = { ".id": string; comment?: string; address?: string };

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
    const value = (key: string) =>
      args.find((a) => a.startsWith(`=${key}=`))?.slice(key.length + 2);
    if (path === "/ip/firewall/nat/add") {
      nat.push({ ".id": `*n${nat.length}`, comment: value("comment") });
    }
    if (path === "/ip/firewall/address-list/add") {
      addressList.push({
        ".id": `*a${addressList.length}`,
        address: value("address"),
      });
    }
    return [];
  });
  return { write };
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
        ([path]) => path === "/ip/firewall/address-list/add",
      ),
    ).toBe(false);
  });
});
