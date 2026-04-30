import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/notifications/route.ts", "utf8");

describe("notifications API tenant context", () => {
  it("wraps notification queries in the authenticated session tenant context", () => {
    expect(routeSource).toContain("runWithRequestTenantContext");
    expect(routeSource).toContain("tenantId: user.tenantId ?? null");
  });
});
