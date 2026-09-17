import { describe, expect, it } from "vitest";

import {
  isApplyMode,
  planSiteBackfill,
} from "../../scripts/backfill-site-from-mixradius-groups-plan";

const TENANT_ID = "tenant-1";

const sites = [
  { id: "site-depok", tenantId: TENANT_ID },
  { id: "site-other-tenant", tenantId: "tenant-2" },
];

const groups = [
  { id: "group-depok", name: "Depok", siteId: "site-depok" },
  { id: "group-pejaten", name: "Pejaten", siteId: "" },
  { id: "group-deleted-site", name: "Cariu", siteId: "site-deleted" },
  { id: "group-other-tenant", name: "Tegal", siteId: "site-other-tenant" },
];

function buildRecord(id: string, mixRadiusGroupId: string | null) {
  return { id, label: `row ${id}`, tenantId: TENANT_ID, mixRadiusGroupId };
}

describe("planSiteBackfill", () => {
  it("mengelompokkan row per site internal yang ditautkan grupnya", () => {
    const plan = planSiteBackfill({
      groups,
      sites,
      records: [
        buildRecord("expense-1", "group-depok"),
        buildRecord("expense-2", "group-depok"),
      ],
    });

    expect(plan.assignments).toEqual([
      { siteId: "site-depok", recordIds: ["expense-1", "expense-2"] },
    ]);
    expect(plan.unmapped).toEqual([]);
  });

  it("melaporkan row yang tidak bisa dipetakan beserta alasannya", () => {
    const plan = planSiteBackfill({
      groups,
      sites,
      records: [
        buildRecord("no-link", "group-pejaten"),
        buildRecord("deleted-site", "group-deleted-site"),
        buildRecord("missing-group", "group-unknown"),
        buildRecord("investor-only", null),
      ],
    });

    expect(plan.assignments).toEqual([]);
    expect(plan.unmapped.map(({ id, reason }) => ({ id, reason }))).toEqual([
      {
        id: "no-link",
        reason: 'grup "Pejaten" tidak tertaut ke site internal',
      },
      {
        id: "deleted-site",
        reason: 'grup "Cariu" tidak tertaut ke site internal',
      },
      {
        id: "missing-group",
        reason: "grup MixRadius tidak ditemukan di DB billing",
      },
      {
        id: "investor-only",
        reason: "hanya punya site investor MixRadius",
      },
    ]);
  });

  it("tidak memakai site milik tenant lain", () => {
    const plan = planSiteBackfill({
      groups,
      sites,
      records: [buildRecord("expense-1", "group-other-tenant")],
    });

    expect(plan.assignments).toEqual([]);
    expect(plan.unmapped[0]?.reason).toBe(
      'site grup "Tegal" milik tenant lain',
    );
  });
});

describe("isApplyMode", () => {
  it("default dry-run dan hanya menulis dengan --apply", () => {
    expect(isApplyMode([])).toBe(false);
    expect(isApplyMode(["--apply"])).toBe(true);
  });
});
