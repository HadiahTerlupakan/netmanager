import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  tenantFindUnique: vi.fn(),
  systemLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: db.userFindUnique },
    tenant: { findUnique: db.tenantFindUnique },
    systemLog: { create: db.systemLogCreate },
  },
}));
vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: (_label: string, fn: () => Promise<unknown>) => fn(),
}));

import { Logger, LogLevel } from "@/lib/logger";

function savedTenantId() {
  expect(db.systemLogCreate).toHaveBeenCalledTimes(1);
  return db.systemLogCreate.mock.calls[0][0].data.tenantId;
}

describe("Logger.logActivity tenantId", () => {
  const logger = new Logger(LogLevel.ERROR);

  beforeEach(() => {
    Object.values(db).forEach((fn) => fn.mockReset());
    db.tenantFindUnique.mockResolvedValue({ id: "tenant-1" });
  });

  it("mengisi tenantId dari user pelaku bila pemanggil tidak menyertakannya", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });

    await logger.logActivity({
      action: "UPDATE",
      subject: "Barang Masuk Kabel",
      userId: "user-1",
    });

    expect(savedTenantId()).toBe("tenant-1");
  });

  it("memakai tenantId eksplisit dari pemanggil", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-x" });

    await logger.logActivity({
      action: "UPDATE",
      subject: "Barang Masuk Kabel",
      userId: "user-1",
      tenantId: "tenant-1",
    });

    expect(savedTenantId()).toBe("tenant-1");
  });

  it("membiarkan tenantId kosong untuk log tanpa user", async () => {
    await logger.logActivity({ action: "SYSTEM", subject: "Cron" });

    expect(savedTenantId()).toBeNull();
  });
});
