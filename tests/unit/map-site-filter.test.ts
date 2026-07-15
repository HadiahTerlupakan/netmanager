import { describe, expect, it } from "vitest";
import {
  buildMapWhere,
  buildTenantWhere,
} from "@/modules/map/utils/tenantContext";
import type { TenantContext } from "@/modules/map/utils/tenantContext";

describe("buildMapWhere", () => {
  const tenantCtx: TenantContext = {
    tenantId: "tenant-a",
    isSuperAdmin: false,
  };

  it("returns tenant filter only when siteId omitted", () => {
    expect(buildMapWhere(tenantCtx)).toEqual({ tenantId: "tenant-a" });
    expect(buildMapWhere(tenantCtx, {})).toEqual({ tenantId: "tenant-a" });
  });

  it("includes siteId when provided", () => {
    expect(buildMapWhere(tenantCtx, { siteId: "site-1" })).toEqual({
      tenantId: "tenant-a",
      siteId: "site-1",
    });
  });

  it("super admin without site returns undefined tenant filter", () => {
    const superCtx: TenantContext = {
      tenantId: null,
      isSuperAdmin: true,
    };
    expect(buildTenantWhere(superCtx)).toBeUndefined();
    expect(buildMapWhere(superCtx)).toBeUndefined();
    expect(buildMapWhere(superCtx, { siteId: "site-1" })).toEqual({
      siteId: "site-1",
    });
  });
});
