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
    expect(buildMapWhere(tenantCtx)).toEqual({
      tenantId: "tenant-a",
      isPlanned: false,
    });
    expect(buildMapWhere(tenantCtx, {})).toEqual({
      tenantId: "tenant-a",
      isPlanned: false,
    });
  });

  it("includes siteId when provided", () => {
    expect(buildMapWhere(tenantCtx, { siteId: "site-1" })).toEqual({
      tenantId: "tenant-a",
      isPlanned: false,
      siteId: "site-1",
    });
  });

  it("super admin without site has no tenant filter but still excludes planned points", () => {
    const superCtx: TenantContext = {
      tenantId: null,
      isSuperAdmin: true,
    };
    expect(buildTenantWhere(superCtx)).toBeUndefined();
    expect(buildMapWhere(superCtx)).toEqual({ isPlanned: false });
    expect(buildMapWhere(superCtx, { siteId: "site-1" })).toEqual({
      isPlanned: false,
      siteId: "site-1",
    });
  });

  it("super admin without any filter must still get isPlanned false (no unfiltered branch)", () => {
    const superCtx: TenantContext = { tenantId: null, isSuperAdmin: true };
    expect(buildMapWhere(superCtx, {})).toEqual({ isPlanned: false });
    expect(buildMapWhere(superCtx, { lingkup: "rencana" })).toEqual({
      isPlanned: true,
    });
    expect(buildMapWhere(superCtx, { lingkup: "semua" })).toEqual({});
  });
});
