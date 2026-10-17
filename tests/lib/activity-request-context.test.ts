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

import {
  createActivityRequestContext,
  hasRecordedDomainActivity,
  readClientInfo,
  runWithActivityRequestContext,
} from "@/lib/activity-request-context";
import { Logger, LogLevel } from "@/lib/logger";

describe("Konteks request untuk Log Aktivitas", () => {
  const logger = new Logger(LogLevel.ERROR);

  beforeEach(() => {
    Object.values(db).forEach((fn) => fn.mockReset());
    db.userFindUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    db.tenantFindUnique.mockResolvedValue({ id: "tenant-1" });
  });

  it("menandai request yang sudah punya log domain dan mengisi IP serta user agent", async () => {
    const context = createActivityRequestContext({
      ipAddress: "10.0.0.7",
      userAgent: "okhttp/4.12.0",
    });

    await runWithActivityRequestContext(context, async () => {
      await logger.logActivity({
        action: "CHECK_OUT",
        subject: "Absensi 2026-10-17",
        userId: "user-1",
      });
    });

    expect(await hasRecordedDomainActivity(context)).toBe(true);
    expect(db.systemLogCreate.mock.calls[0][0].data).toMatchObject({
      ipAddress: "10.0.0.7",
      userAgent: "okhttp/4.12.0",
    });
  });

  it("tidak menandai request bila tidak ada log domain", async () => {
    const context = createActivityRequestContext({
      ipAddress: "10.0.0.7",
      userAgent: "okhttp/4.12.0",
    });

    await runWithActivityRequestContext(context, async (): Promise<void> => {});

    expect(await hasRecordedDomainActivity(context)).toBe(false);
  });

  it("tetap menulis log di luar request tanpa IP", async () => {
    await logger.logActivity({
      action: "AUTO_ABSENT",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "cron:process-absence" },
      tenantId: "tenant-1",
    });

    expect(db.systemLogCreate.mock.calls[0][0].data).toMatchObject({
      ipAddress: null,
      userAgent: null,
    });
  });
});

describe("Keamanan konteks Log Aktivitas", () => {
  const logger = new Logger(LogLevel.ERROR);

  beforeEach(() => {
    Object.values(db).forEach((fn) => fn.mockReset());
    db.tenantFindUnique.mockResolvedValue({ id: "tenant-1" });
  });

  it("tidak menganggap aksi tercatat bila log domain dilewati", async () => {
    db.userFindUnique.mockResolvedValue(null);
    const context = createActivityRequestContext({
      ipAddress: null,
      userAgent: null,
    });

    await runWithActivityRequestContext(context, async () => {
      await logger.logActivity({
        action: "UPDATE",
        subject: "LeaveRequest",
        userId: "user-tidak-ada",
      });
    });

    expect(await hasRecordedDomainActivity(context)).toBe(false);
  });

  it("tidak menganggap aksi tercatat bila penulisan log gagal", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    db.systemLogCreate.mockRejectedValue(new Error("db down"));
    const context = createActivityRequestContext({
      ipAddress: null,
      userAgent: null,
    });

    await runWithActivityRequestContext(context, async () => {
      void logger.logActivity({
        action: "CHECK_OUT",
        subject: "Absensi 2026-10-17",
        userId: "user-1",
      });
    });

    expect(await hasRecordedDomainActivity(context)).toBe(false);
  });

  it("menunggu log domain fire-and-forget selesai sebelum memutuskan", async () => {
    db.userFindUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    const context = createActivityRequestContext({
      ipAddress: null,
      userAgent: null,
    });

    await runWithActivityRequestContext(context, async () => {
      void logger.logActivity({
        action: "CHECK_OUT",
        subject: "Absensi 2026-10-17",
        userId: "user-1",
      });
    });

    expect(await hasRecordedDomainActivity(context)).toBe(true);
  });
});

describe("readClientInfo", () => {
  it("mengutamakan X-Real-Ip dari proxy daripada X-Forwarded-For kiriman klien", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 36.71.8.9",
      "x-real-ip": "36.71.8.9",
    });
    expect(readClientInfo(headers).ipAddress).toBe("36.71.8.9");
  });

  it("memakai entri terakhir X-Forwarded-For yang ditambahkan proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 36.71.8.9" });
    expect(readClientInfo(headers).ipAddress).toBe("36.71.8.9");
  });
});
