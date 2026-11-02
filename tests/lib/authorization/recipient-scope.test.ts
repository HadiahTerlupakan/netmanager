import { describe, expect, it } from "vitest";

import {
  buildRecipientSiteScopeWhere,
  isSiteUnrestrictedRecipient,
} from "@/lib/authorization/recipient-scope";

function candidate(
  actions: string[],
  departmentId: string | null = "dept-tech",
) {
  return {
    departmentId,
    role: {
      permission: actions.map((action) => ({ resource: "workorders", action })),
    },
  };
}

describe("isSiteUnrestrictedRecipient", () => {
  const target = { resource: "workorders", departmentId: "dept-tech" };

  it("peran tanpa site_only dan department_only tidak dibatasi", () => {
    expect(isSiteUnrestrictedRecipient(candidate(["verify"]), target)).toBe(
      true,
    );
  });

  it("site_only membatasi ke site sendiri", () => {
    expect(
      isSiteUnrestrictedRecipient(candidate(["verify", "site_only"]), target),
    ).toBe(false);
  });

  it("department_only hanya lolos untuk departemen yang sama", () => {
    expect(
      isSiteUnrestrictedRecipient(
        candidate(["verify", "department_only"]),
        target,
      ),
    ).toBe(true);
    expect(
      isSiteUnrestrictedRecipient(
        candidate(["verify", "department_only"], "dept-ops"),
        target,
      ),
    ).toBe(false);
  });

  it("alias list:site_only tidak dianggap pembatas, sama seperti daftar WO", () => {
    expect(
      isSiteUnrestrictedRecipient(
        {
          departmentId: null,
          role: { permission: [{ resource: "list", action: "site_only" }] },
        },
        target,
      ),
    ).toBe(true);
  });
});

describe("buildRecipientSiteScopeWhere", () => {
  it("data tanpa site hanya dibatasi tenant", () => {
    expect(
      buildRecipientSiteScopeWhere({
        resource: "workorders",
        tenantId: "tenant-1",
      }),
    ).toEqual({ tenantId: "tenant-1" });
  });

  it("tanpa tenant tidak melebar lintas site", () => {
    expect(
      buildRecipientSiteScopeWhere({ resource: "workorders", siteId: "s1" }),
    ).toEqual({
      OR: [
        { siteId: "s1" },
        { siteId: null },
        { userSites: { some: { siteId: "s1" } } },
      ],
    });
  });

  it("dengan tenant menambah cabang peran tanpa site_only", () => {
    const where = buildRecipientSiteScopeWhere({
      resource: "workorders",
      siteId: "s1",
      tenantId: "tenant-1",
    });

    expect(where.tenantId).toBe("tenant-1");
    expect(where.OR).toHaveLength(4);
    expect(where.OR?.[3]).toEqual({
      AND: [
        {
          role: {
            permission: {
              none: { resource: "workorders", action: "site_only" },
            },
          },
        },
        {
          OR: [
            {
              role: {
                permission: {
                  none: { resource: "workorders", action: "department_only" },
                },
              },
            },
          ],
        },
      ],
    });
  });
});
