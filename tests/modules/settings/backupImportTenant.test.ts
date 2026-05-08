import { beforeEach, describe, expect, it, vi } from "vitest";

const execAsync = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("backfillTenantId", () => {
  beforeEach(() => {
    vi.resetModules();
    execAsync.mockReset();
  });

  it("throws when duplicate key constraint violation occurs during backfill", async () => {
    execAsync
      .mockResolvedValueOnce({ stdout: "users\nroles", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockRejectedValueOnce(
        new Error("duplicate key value violates unique constraint"),
      );

    const { backfillTenantId } =
      await import("@/modules/settings/services/backupService.import.tenant");

    await expect(
      backfillTenantId(
        {
          extractDir: "/tmp",
          execAsync,
          tenantId: "tenant-123",
        },
        "netmanager",
        "psql",
      ),
    ).rejects.toThrow("duplicate key value violates unique constraint");

    expect(execAsync).toHaveBeenCalledTimes(3);
  });

  it("updates all rows with null tenantId in one statement", async () => {
    execAsync
      .mockResolvedValueOnce({ stdout: "users", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });

    const { backfillTenantId } =
      await import("@/modules/settings/services/backupService.import.tenant");

    await backfillTenantId(
      {
        extractDir: "/tmp",
        execAsync,
        tenantId: "tenant-123",
      },
      "netmanager",
      "psql",
    );

    const updateCall = execAsync.mock.calls.find(([command]) =>
      String(command).includes("UPDATE"),
    );
    expect(updateCall?.[0]).toContain('WHERE \\"tenantId\\" IS NULL');
    expect(updateCall?.[0]).not.toContain("LIMIT 1000");
  });
});
