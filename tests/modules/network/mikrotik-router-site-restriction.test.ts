import { describe, expect, it } from "vitest";
import {
  isRestrictedToOwnRouterSite,
  MIKROTIK_SITE_ONLY_PERMISSION,
} from "@/modules/network/services/mikrotik-router.access";
import { lingkupSiteUntuk } from "@/modules/roles/client";

describe("isRestrictedToOwnRouterSite", () => {
  it("mikrotik:site_only pada role mengunci ke site sendiri", () => {
    expect(
      isRestrictedToOwnRouterSite({
        isSuperAdmin: false,
        permissions: ["mikrotik:read", "mikrotik:site_only"],
      }),
    ).toBe(true);
  });

  it("role wildcard `*` tidak dianggap dibatasi (dicocokkan persis)", () => {
    expect(
      isRestrictedToOwnRouterSite({ isSuperAdmin: false, permissions: ["*"] }),
    ).toBe(false);
  });

  it("tanpa site_only tidak dibatasi", () => {
    expect(
      isRestrictedToOwnRouterSite({
        isSuperAdmin: false,
        permissions: ["mikrotik:read"],
      }),
    ).toBe(false);
  });

  it("super admin selalu bebas meski memegang site_only", () => {
    expect(
      isRestrictedToOwnRouterSite({
        isSuperAdmin: true,
        permissions: ["mikrotik:site_only"],
      }),
    ).toBe(false);
  });
});

describe("isRestrictedToOwnRouterSite — konsisten dengan lingkupSiteUntuk", () => {
  const kasus: Array<{ isSuperAdmin: boolean; permissions: string[] }> = [
    { isSuperAdmin: false, permissions: [MIKROTIK_SITE_ONLY_PERMISSION] },
    { isSuperAdmin: false, permissions: ["*"] },
    { isSuperAdmin: false, permissions: ["*", MIKROTIK_SITE_ONLY_PERMISSION] },
    { isSuperAdmin: false, permissions: ["expense:site_only"] },
    { isSuperAdmin: true, permissions: [MIKROTIK_SITE_ONLY_PERMISSION] },
  ];

  it.each(kasus)("sama dengan lingkupSiteUntuk(mikrotik) untuk %o", (input) => {
    const harapan = lingkupSiteUntuk({
      ...input,
      resource: "mikrotik",
      siteIds: [],
    }).dibatasi;
    expect(isRestrictedToOwnRouterSite(input)).toBe(harapan);
  });

  it("konstanta izin bernilai mikrotik:site_only", () => {
    expect(MIKROTIK_SITE_ONLY_PERMISSION).toBe("mikrotik:site_only");
  });
});
