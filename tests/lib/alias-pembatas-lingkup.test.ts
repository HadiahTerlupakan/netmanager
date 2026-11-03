import { describe, expect, it } from "vitest";

import {
  hasCapability,
  tambahkanAliasPembatasLingkup,
} from "@/lib/permission-aliases";
import { getWorkOrderScopeViolation } from "@/modules/work-order/services/work-order-access";

// Regresi 2026-11-03 (security review): role ber-`list:read` + `list:site_only`
// lolos cek baca lewat alias, tetapi pembatas lingkup dicocokkan persis
// (`workorders:site_only`) sehingga ia tidak terbaca terbatas → semua site.
describe("tambahkanAliasPembatasLingkup", () => {
  it("menambah nama standar untuk pembatas lingkup bernama lama", () => {
    const hasil = tambahkanAliasPembatasLingkup([
      "list:read",
      "list:site_only",
      "list:department_only",
    ]);
    expect(hasil).toEqual(
      expect.arrayContaining([
        "workorders:site_only",
        "workorders:department_only",
      ]),
    );
  });

  it("tidak menambah kapabilitas apa pun", () => {
    const hasil = tambahkanAliasPembatasLingkup(["list:read"]);
    expect(hasil).toEqual(["list:read"]);
  });

  it("tidak mengubah wildcard dan tidak menduplikasi", () => {
    expect(tambahkanAliasPembatasLingkup(["*"])).toEqual(["*"]);
    expect(
      tambahkanAliasPembatasLingkup(["list:site_only", "workorders:site_only"]),
    ).toHaveLength(2);
  });

  it("role list:read + list:site_only kini terkunci ke site-nya di cek lingkup WO", () => {
    const permissions = tambahkanAliasPembatasLingkup([
      "list:read",
      "list:site_only",
    ]);
    expect(hasCapability(permissions, "workorders:read")).toBe(true);
    const pengguna = { permissions, siteIds: ["site-a"] };
    expect(
      getWorkOrderScopeViolation(
        { siteId: "site-b", departmentId: null },
        pengguna,
      ),
    ).not.toBeNull();
    expect(
      getWorkOrderScopeViolation(
        { siteId: "site-a", departmentId: null },
        pengguna,
      ),
    ).toBeNull();
  });
});
