import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIXRADIUS_ROUTES = [
  "app/api/integrations/mixradius/accounts/[id]/route.ts",
  "app/api/integrations/mixradius/accounts/route.ts",
  "app/api/integrations/mixradius/customers/[id]/route.ts",
  "app/api/integrations/mixradius/customers/route.ts",
  "app/api/integrations/mixradius/dismantle/route.ts",
  "app/api/integrations/mixradius/groups/[id]/route.ts",
  "app/api/integrations/mixradius/groups/route.ts",
  "app/api/integrations/mixradius/invoice-counts/route.ts",
  "app/api/integrations/mixradius/npl/route.ts",
  "app/api/integrations/mixradius/odps/[id]/customers/route.ts",
  "app/api/integrations/mixradius/odps/route.ts",
  "app/api/integrations/mixradius/owners/route.ts",
  "app/api/integrations/mixradius/print/[id]/route.ts",
  "app/api/integrations/mixradius/reports/delete/[id]/route.ts",
  "app/api/integrations/mixradius/sessions/route.ts",
  "app/api/integrations/mixradius/test/route.ts",
];

describe("MixRadius route authorization batch consistency", () => {
  it("all MixRadius routes use centralized access service instead of local permission composition", () => {
    const violations: string[] = [];

    for (const routePath of MIXRADIUS_ROUTES) {
      const fullPath = resolve(process.cwd(), routePath);
      const source = readFileSync(fullPath, "utf8");

      if (source.includes('permissions.includes("*")')) {
        violations.push(`${routePath}: still uses permissions.includes("*")`);
      }

      if (source.includes("getUserPermissions(user.id)")) {
        violations.push(`${routePath}: still uses getUserPermissions(user.id)`);
      }

      if (
        !source.includes("getMixRadiusAccessService") &&
        !source.includes("hasAnyPermission")
      ) {
        violations.push(
          `${routePath}: does not use getMixRadiusAccessService or hasAnyPermission helper`,
        );
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `MixRadius routes still use local permission composition:\n${violations.join("\n")}`,
      );
    }
  });

  it("routes with multiple permission options delegate to access service with array", () => {
    const groupsRoutePath = resolve(
      process.cwd(),
      "app/api/integrations/mixradius/groups/route.ts",
    );
    const groupsSource = readFileSync(groupsRoutePath, "utf8");

    expect(groupsSource).toContain("getMixRadiusAccessService");
    expect(groupsSource).toContain(".canAccess(");
    expect(groupsSource).not.toContain('permissions.includes("*")');
  });

  it("dismantle route with composite permission delegates to access service", () => {
    const dismantleRoutePath = resolve(
      process.cwd(),
      "app/api/integrations/mixradius/dismantle/route.ts",
    );
    const dismantleSource = readFileSync(dismantleRoutePath, "utf8");

    expect(dismantleSource).toContain("getMixRadiusAccessService");
    expect(dismantleSource).toContain(".canAccessDismantle(");
    expect(dismantleSource).not.toContain('permissions.includes("*")');
    expect(dismantleSource).not.toContain("getUserPermissions(user.id)");
  });
});
