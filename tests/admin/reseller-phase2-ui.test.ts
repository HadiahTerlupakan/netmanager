import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const menuConfigPath = "lib/menu-config.ts";
const resellerPagePath = "app/admin/resellers/page.tsx";
const resellerClientPath = "app/admin/resellers/ResellersClient.tsx";
const pppInfoSectionPath =
  "app/admin/pelanggan/ppp/components/info/PppClientInfoTabSection.tsx";
const pppUpdateRoutePath = "app/api/pelanggan-ppp/[id]/route-handlers-impl.ts";
// `route.ts` kini hanya re-export satu baris; implementasinya ada di berkas
// impl, mengikuti pola folder `[id]` di atas.
const pppCreateRoutePath = "app/api/pelanggan-ppp/route-handlers-impl.ts";
const pelangganServiceHelperPath =
  "modules/pelanggan/services/pelanggan-service.helpers.ts";

describe("admin reseller Phase 2 UI", () => {
  it("registers reseller in the admin menu with feature and permission mapping", () => {
    const source = readFileSync(menuConfigPath, "utf8");

    expect(source).toContain('code: "RESELLER"');
    expect(source).toContain('path: "/admin/resellers"');
    expect(source).toContain('featureModule: "reseller"');
  });

  it("adds a protected reseller admin page", () => {
    const source = readFileSync(resellerPagePath, "utf8");

    expect(source).toContain("ensurePermission");
    expect(source).toContain("reseller:read");
    expect(source).toContain("ResellersClient");
  });

  it("builds reseller CRUD UI against admin reseller APIs", () => {
    const source = readFileSync(resellerClientPath, "utf8");

    expect(source).toContain("/api/admin/resellers");
    expect(source).toContain("ResponsiveTable");
    expect(source).toContain("Modal");
    expect(source).toContain("reseller:create");
    expect(source).toContain("reseller:update");
    expect(source).toContain("reseller:delete");
  });

  it("surfaces reseller assignment fields in PPP customer form and routes", () => {
    const sectionSource = readFileSync(pppInfoSectionPath, "utf8");
    const updateRouteSource = readFileSync(pppUpdateRoutePath, "utf8");
    const createRouteSource = readFileSync(pppCreateRoutePath, "utf8");
    const helperSource = readFileSync(pelangganServiceHelperPath, "utf8");

    expect(sectionSource).toContain("resellerId");
    expect(sectionSource).toContain("resellerOutletId");
    expect(sectionSource).toContain("Pilih Reseller");
    expect(updateRouteSource).toContain("resellerId: formData.get");
    expect(updateRouteSource).toContain("resellerOutletId: formData.get");
    expect(createRouteSource).toContain(
      "tenantId: session.user.tenantId ?? null",
    );
    expect(helperSource).toContain("tenantId: data.tenantId ?? null");
  });
});
