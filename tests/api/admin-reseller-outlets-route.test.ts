import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const outletListRoute = "app/api/admin/resellers/[id]/outlets/route.ts";
const outletDetailRoute =
  "app/api/admin/resellers/[id]/outlets/[outletId]/route.ts";

describe("admin reseller outlet API route", () => {
  it("exposes outlet list and create handlers under a reseller through createHandler", () => {
    const source = readFileSync(outletListRoute, "utf8");

    expect(source).toContain("createHandler");
    expect(source).toMatch(/auth:\s*true/);
    expect(source).toContain("reseller:read");
    expect(source).toContain("reseller:update");
    expect(source).toContain("getResellerOutletService");
  });

  it("exposes outlet detail update and delete handlers without direct Prisma access", () => {
    const source = readFileSync(outletDetailRoute, "utf8");

    expect(source).toContain("createHandler");
    expect(source).toContain("reseller:read");
    expect(source).toContain("reseller:update");
    expect(source).toContain("reseller:delete");
    expect(source).toContain("getResellerOutletService");
    expect(source).not.toContain("prisma.");
  });
});
