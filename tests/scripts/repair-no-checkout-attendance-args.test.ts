import { describe, expect, it, vi } from "vitest";

import {
  parseRepairArgs,
  resolveRepairTenantIds,
  runRepairTenantContext,
} from "../../scripts/repair-no-checkout-attendance-args";

describe("repair no-checkout attendance args", () => {
  it("accepts all tenant mode without a tenant id", () => {
    const args = parseRepairArgs([
      "--all-tenants",
      "--from=2026-04-25",
      "--to=2026-04-25",
    ]);

    expect(args).toMatchObject({ allTenants: true, dryRun: true });
    expect(args.tenantId).toBeNull();
  });

  it("rejects running without tenant scope", () => {
    expect(() =>
      parseRepairArgs(["--from=2026-04-25", "--to=2026-04-25"]),
    ).toThrow("--tenant=<tenantId> atau --all-tenants wajib diisi");
  });

  it("resolves all active tenant ids when all tenant mode is enabled", async () => {
    const tenantRepository = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "tenant-1" }, { id: "tenant-2" }]),
    };

    await expect(
      resolveRepairTenantIds(
        {
          tenantId: null,
          allTenants: true,
          startDate: new Date("2026-04-24T17:00:00.000Z"),
          endDate: new Date("2026-04-25T16:59:59.999Z"),
          dryRun: true,
        },
        tenantRepository,
      ),
    ).resolves.toEqual(["tenant-1", "tenant-2"]);
  });

  it("runs tenant repair inside tenant context", async () => {
    const runWithContext = vi.fn(async (_context, callback) => callback());
    const callback = vi.fn().mockResolvedValue("ok");

    await expect(
      runRepairTenantContext("tenant-1", callback, runWithContext),
    ).resolves.toBe("ok");

    expect(runWithContext).toHaveBeenCalledWith(
      { tenantId: "tenant-1", isSuperAdmin: false },
      callback,
    );
  });
});
