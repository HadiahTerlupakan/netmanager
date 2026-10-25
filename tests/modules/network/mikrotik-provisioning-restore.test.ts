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
});
