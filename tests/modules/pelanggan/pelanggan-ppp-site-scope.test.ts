import { describe, expect, it } from "vitest";

import { withPelangganPppSiteScope } from "@/modules/pelanggan/services/pelanggan-ppp-route-validation";
import { checkSiteRestriction } from "@/modules/roles";

function restrictionFor(permissions: string[]) {
  return checkSiteRestriction(
    {
      user: {
        id: "u1",
        role: "ADMIN",
        siteIds: ["site-a"],
        permissions: withPelangganPppSiteScope(permissions),
      },
    } as never,
    "pelanggan",
  );
}

// Regresi: UI menawarkan ppp:site_only, backend Pelanggan PPP hanya membaca
// pelanggan:site_only — toggle itu tidak menggigit.
describe("withPelangganPppSiteScope", () => {
  it("ppp:site_only membatasi Pelanggan PPP", () => {
    expect(restrictionFor(["pelanggan:read", "ppp:site_only"])).toMatchObject({
      isRestricted: true,
      siteIds: ["site-a"],
    });
  });

  it("pelanggan:site_only tetap membatasi", () => {
    expect(
      restrictionFor(["pelanggan:read", "pelanggan:site_only"]).isRestricted,
    ).toBe(true);
  });

  it("tanpa toggle — termasuk wildcard non-super — tidak dibatasi", () => {
    expect(restrictionFor(["pelanggan:read"]).isRestricted).toBe(false);
    expect(restrictionFor(["*"]).isRestricted).toBe(false);
  });

  it("tidak menggandakan permission yang sudah ada", () => {
    const permissions = ["pelanggan:site_only", "ppp:site_only"];
    expect(withPelangganPppSiteScope(permissions)).toBe(permissions);
  });
});
