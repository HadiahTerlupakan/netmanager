import { beforeEach, describe, expect, it, vi } from "vitest";

const execAsync = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("pushPrismaSchema", () => {
  beforeEach(() => {
    vi.resetModules();
    execAsync.mockReset();
  });

  it("skips db push when migrate diff reports schema already compatible", async () => {
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    const { pushPrismaSchema } =
      await import("@/modules/settings/services/backupService.import.prisma");

    await pushPrismaSchema({
      execAsync,
      prismaBin: "prisma",
      dbName: "netmanager",
      database: "netmanager",
      psqlCommand: "psql",
    });

    expect(execAsync).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls[0]?.[0]).toContain("migrate diff");
    expect(execAsync.mock.calls[0]?.[0]).not.toContain("db push");
  });

  it("runs db push when migrate diff reports schema mismatch", async () => {
    execAsync
      .mockRejectedValueOnce(
        Object.assign(new Error("schema mismatch"), { code: 2 }),
      )
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "1", stderr: "" });

    const { pushPrismaSchema } =
      await import("@/modules/settings/services/backupService.import.prisma");

    await pushPrismaSchema({
      execAsync,
      prismaBin: "prisma",
      dbName: "netmanager",
      database: "netmanager",
      psqlCommand: "psql",
    });

    expect(execAsync).toHaveBeenCalled();
    expect(
      execAsync.mock.calls.some(([command]) =>
        String(command).includes("db push --accept-data-loss"),
      ),
    ).toBe(true);
  });

  it("throws when migrate diff fails for reasons other than schema mismatch", async () => {
    execAsync.mockRejectedValueOnce(
      Object.assign(new Error("prisma binary missing"), { code: 1 }),
    );

    const { pushPrismaSchema } =
      await import("@/modules/settings/services/backupService.import.prisma");

    await expect(
      pushPrismaSchema({
        execAsync,
        prismaBin: "prisma",
        dbName: "netmanager",
        database: "netmanager",
        psqlCommand: "psql",
      }),
    ).rejects.toThrow("prisma binary missing");
  });
});
