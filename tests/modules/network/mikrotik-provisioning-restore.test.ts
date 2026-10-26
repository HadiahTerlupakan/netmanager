import { describe, expect, it } from "vitest";
import { needsRestore } from "@/modules/network/services/mikrotik-provisioning.restore";

describe("needsRestore", () => {
  it("properti yang hilang dari baris dianggap berubah", () => {
    expect(
      needsRestore({ ".id": "*1", chain: "srcnat" }, [
        "=chain=srcnat",
        "=dst-port=80",
      ]),
    ).toBe(true);
  });

  it("passthrough yang hilang dari baris dianggap berubah", () => {
    expect(needsRestore({ ".id": "*1" }, ["=passthrough=yes"])).toBe(true);
  });

  it("boolean yang dicetak true/false sama dengan yes/no", () => {
    expect(
      needsRestore({ ".id": "*1", passthrough: "true", log: "false" }, [
        "=passthrough=yes",
        "=log=no",
      ]),
    ).toBe(false);
  });

  it("nilai bernama properti bawaan objek tidak dianggap alias", () => {
    expect(needsRestore({ ".id": "*1" }, ["=comment=constructor"])).toBe(true);
  });

  it("properti di daftar unset yang masih ada memicu restore", () => {
    const row = {
      ".id": "*1",
      "to-ports": "8181",
      "to-addresses": "10.99.0.1",
    };
    expect(needsRestore(row, ["=to-ports=8181"], ["to-addresses"])).toBe(true);
    expect(
      needsRestore(
        { ".id": "*1", "to-ports": "8181" },
        ["=to-ports=8181"],
        ["to-addresses"],
      ),
    ).toBe(false);
  });
});
