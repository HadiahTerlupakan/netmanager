import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
}));

vi.mock("@/lib/api-response", () => ({
  ApiErrors: {
    badRequest: (error: string, details?: unknown) =>
      NextResponse.json(
        { error, ...(details ? { details } : {}) },
        { status: 400 },
      ),
    forbidden: (error: string) => NextResponse.json({ error }, { status: 403 }),
    internalError: (error: string) =>
      NextResponse.json({ error }, { status: 500 }),
  },
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

describe("admin attendance backdate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.isSuperAdmin.mockReturnValue(true);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        workDays: "Mon,Tue,Wed,Thu,Fri",
        joinDate: new Date("2026-04-01T00:00:00.000Z"),
      },
    ] as never);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1" } as never);
  });

  it("skips ABSENT backfill before user joinDate", async () => {
    const { POST } = await import("@/app/api/admin/attendance/backdate/route");

    const response = await POST(
      new NextRequest("http://localhost/api/admin/attendance/backdate", {
        method: "POST",
        body: JSON.stringify({
          startDate: "2026-03-03",
          endDate: "2026-03-03",
        }),
        headers: { "content-type": "application/json" },
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });
});
