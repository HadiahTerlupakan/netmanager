import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const listRoute = "app/api/admin/resellers/route.ts";
const detailRoute = "app/api/admin/resellers/[id]/route.ts";

describe("admin reseller API route", () => {
  it("exposes tenant-scoped reseller list and create handlers through createHandler", () => {
    const source = readFileSync(listRoute, "utf8");

    expect(source).toContain("createHandler");
    expect(source).toMatch(/auth:\s*true/);
    expect(source).toContain("reseller:read");
    expect(source).toContain("reseller:create");
    expect(source).toContain("getResellerService");
  });

  it("exposes reseller detail update and delete handlers through service layer", () => {
    const source = readFileSync(detailRoute, "utf8");

    expect(source).toContain("createHandler");
    expect(source).toContain("reseller:read");
    expect(source).toContain("reseller:update");
    expect(source).toContain("reseller:delete");
    expect(source).toContain("getResellerService");
    expect(source).not.toContain("prisma.");
  });
});
