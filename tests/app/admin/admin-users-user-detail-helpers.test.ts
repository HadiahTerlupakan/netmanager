import { describe, expect, it } from "vitest";

import {
  getSelectedSitesFromUser,
  normalizeSelectedSites,
} from "@/app/admin/users/[id]/user-detail-helpers";

describe("admin user detail helpers", () => {
  it("membersihkan duplicate site relation saat hydrate selected sites", () => {
    const selectedSites = getSelectedSitesFromUser({
      siteId: null,
      userSites: [
        { siteId: "site-1", isPrimary: true },
        { siteId: "site-1", isPrimary: false },
        { siteId: "site-2", isPrimary: false },
      ],
    });

    expect(selectedSites).toEqual([
      { siteId: "site-1", isPrimary: true },
      { siteId: "site-2", isPrimary: false },
    ]);
  });

  it("menormalkan payload selected sites sebelum submit", () => {
    expect(
      normalizeSelectedSites([
        { siteId: "site-1", isPrimary: false },
        { siteId: "site-1", isPrimary: true },
        { siteId: "site-2", isPrimary: false },
      ]),
    ).toEqual([
      { siteId: "site-1", isPrimary: true },
      { siteId: "site-2", isPrimary: false },
    ]);
  });
});
