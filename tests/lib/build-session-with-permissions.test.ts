import { describe, expect, it } from "vitest";

import { buildSessionWithPermissions } from "@/lib/api/build-session-with-permissions";

describe("buildSessionWithPermissions", () => {
  it("injects permissions into session user object", () => {
    const session = {
      user: { id: "u1", email: "a@b.c", role: "ADMIN", tenantId: "t1" },
    };
    const permissions = ["support:read", "support:update"];

    const result = buildSessionWithPermissions(session, permissions);

    expect(result.user.permissions).toEqual(permissions);
  });

  it("preserves all existing session.user fields", () => {
    const session = {
      user: {
        id: "u2",
        email: "b@c.d",
        role: "STAFF",
        tenantId: "t2",
        siteId: "site-1",
        siteIds: ["site-1"],
        isSuperAdmin: false,
      },
    };
    const permissions = ["support:read"];

    const result = buildSessionWithPermissions(session, permissions);

    expect(result.user.id).toBe("u2");
    expect(result.user.siteId).toBe("site-1");
    expect(result.user.siteIds).toEqual(["site-1"]);
    expect(result.user.isSuperAdmin).toBe(false);
  });

  it("overwrites existing permissions field if already set", () => {
    const session = {
      user: {
        id: "u3",
        email: "c@d.e",
        permissions: ["old:permission"],
      },
    };
    const permissions = ["support:update"];

    const result = buildSessionWithPermissions(session, permissions);

    expect(result.user.permissions).toEqual(["support:update"]);
  });

  it("works with empty permissions array", () => {
    const session = { user: { id: "u4", email: "d@e.f" } };

    const result = buildSessionWithPermissions(session, []);

    expect(result.user.permissions).toEqual([]);
  });
});
