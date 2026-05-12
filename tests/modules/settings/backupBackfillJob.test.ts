import { beforeEach, describe, expect, it, vi } from "vitest";

const execAsync = vi.fn();
const scriptExists = vi.fn();
const loggerError = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    existsSync: scriptExists,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerError,
  },
}));

vi.mock("@/modules/settings/services/backupService", () => ({
  findTsxCommand: () => '"/app/node_modules/.bin/tsx"',
}));

describe("runTenantBackfillJob", () => {
  beforeEach(() => {
    vi.resetModules();
    execAsync.mockReset();
    scriptExists.mockReset();
    loggerError.mockReset();
    scriptExists.mockReturnValue(true);
  });

  it("tetap mengembalikan sukses ketika script keluar dengan optional failure", async () => {
    execAsync.mockRejectedValueOnce(
      Object.assign(new Error("Command failed"), {
        stdout:
          "✅ [Users                    ] Updated 10 orphaned records\n❌ [TenantSettings           ] Failed: duplicate key\n⚠️ Optional failures: 1\n",
        stderr: "❌ [TenantSettings           ] Failed: duplicate key\n",
      }),
    );

    const { runTenantBackfillJob } =
      await import("@/modules/settings/services/backupService.backfill");

    const result = await runTenantBackfillJob(execAsync as never);

    expect(result).toEqual({
      success: true,
      message:
        "Sinkronisasi berhasil dijalankan. Data telah dihubungkan dengan Tenant yang benar.",
      log: expect.stringContaining("Optional failures: 1"),
    });
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("melempar error ketika script backfill tidak ditemukan", async () => {
    scriptExists.mockReturnValue(false);

    const { runTenantBackfillJob } =
      await import("@/modules/settings/services/backupService.backfill");

    await expect(runTenantBackfillJob(execAsync as never)).rejects.toThrow(
      "Script backfill-tenant.ts tidak ditemukan",
    );
  });
});
