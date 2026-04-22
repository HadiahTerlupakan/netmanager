import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getUserPermissions: vi.fn().mockResolvedValue([]),
  isSuperAdmin: vi.fn().mockReturnValue(true),
  logActivitySafe: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  };
});

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mockFns.logActivitySafe,
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

import { DELETE, GET, PATCH } from "@/app/api/admin/attendance/[id]/route";

describe("admin attendance id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid attendance id before touching persistence on PATCH", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/attendance/%20", {
        method: "PATCH",
      }),
      {
        params: { id: "" },
        session: {
          user: {
            id: "admin-1",
          },
        },
        validated: {
          checkIn: "2026-03-20T02:05:00.000Z",
          status: "LATE",
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("ID tidak valid");
    expect(prismaMock.attendance.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid attendance id before touching persistence on DELETE", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance/%20", {
        method: "DELETE",
      }),
      {
        params: { id: "" },
        session: {
          user: {
            id: "admin-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("ID tidak valid");
    expect(prismaMock.attendance.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.attendance.delete).not.toHaveBeenCalled();
  });

  it("rejects PATCH when attendance date is before user joinDate", async () => {
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: "attendance-before-join-1",
      checkIn: new Date("2026-03-03T00:00:00.000Z"),
      user: {
        id: "user-new-1",
        siteId: "site-1",
        departmentId: "dept-1",
        joinDate: new Date("2026-04-01T00:00:00.000Z"),
        startWorkTime: "08:00",
        workingHourMode: "FIXED",
        shift: null,
      },
    } as never);
    prismaMock.attendance.update.mockResolvedValue({
      id: "attendance-before-join-1",
    } as never);

    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-before-join-1",
        {
          method: "PATCH",
        },
      ),
      {
        params: { id: "attendance-before-join-1" },
        session: {
          user: {
            id: "admin-1",
          },
        },
        validated: {
          status: "ABSENT",
          notes: "manual edit",
        },
      } as never,
    );

    expect(response.status).toBe(400);
    expect(prismaMock.attendance.update).not.toHaveBeenCalled();
  });

  it("rejects GET when attendance date is before user joinDate", async () => {
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: "attendance-before-join-get-1",
      tenantId: "tenant-1",
      checkIn: new Date("2026-03-03T00:00:00.000Z"),
      user: {
        id: "user-new-1",
        name: "User Baru",
        email: "baru@example.com",
        image: null,
        siteId: "site-1",
        departmentId: "dept-1",
        joinDate: new Date("2026-04-01T00:00:00.000Z"),
        departments: { name: "Ops" },
        sites: { name: "HQ" },
      },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-before-join-get-1",
        {
          method: "GET",
        },
      ),
      {
        params: { id: "attendance-before-join-get-1" },
        session: {
          user: {
            id: "admin-1",
          },
        },
      } as never,
    );

    expect(response.status).toBe(404);
  });

  it("recalculates PATCH status correctly for DST-sensitive timezone inputs", async () => {
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: "attendance-fixed-1",
      user: {
        id: "user-fixed-1",
        siteId: "site-1",
        departmentId: "dept-1",
        startWorkTime: "01:00",
        workingHourMode: "FIXED",
        shift: null,
      },
    } as never);

    prismaMock.settings.findFirst
      .mockResolvedValueOnce({ value: "0" } as never)
      .mockResolvedValueOnce({ value: "America/New_York" } as never);

    prismaMock.attendance.update.mockImplementation(
      async ({ data }: { data: { status: string; checkIn: string } }) => ({
        id: "attendance-fixed-1",
        status: data.status,
        checkIn: data.checkIn,
        user: {
          name: "Fixed User",
          email: "fixed@example.com",
          image: null as string | null,
          departments: null as { name: string } | null,
          sites: null as { name: string } | null,
        },
      }),
    );

    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-fixed-1",
        {
          method: "PATCH",
        },
      ),
      {
        params: { id: "attendance-fixed-1" },
        session: {
          user: {
            id: "admin-1",
          },
        },
        validated: {
          checkIn: "2026-11-01T05:05:00.000Z",
          status: "LATE",
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ON_TIME",
        }),
      }),
    );
    expect(body.data.status).toBe("ON_TIME");
  });

  it("recalculates SHIFT attendance edits from shift.startTime instead of startWorkTime fallback", async () => {
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: "attendance-shift-1",
      user: {
        id: "user-shift-1",
        siteId: "site-1",
        departmentId: "dept-1",
        startWorkTime: "08:00",
        workingHourMode: "SHIFT",
        shift: {
          startTime: "09:00",
          endTime: "17:00",
        },
      },
    } as never);

    prismaMock.settings.findFirst
      .mockResolvedValueOnce({ value: "10" } as never)
      .mockResolvedValueOnce({ value: "Asia/Jakarta" } as never);

    prismaMock.attendance.update.mockImplementation(
      async ({ data }: { data: { status: string; checkIn: string } }) => ({
        id: "attendance-shift-1",
        status: data.status,
        checkIn: data.checkIn,
        user: {
          name: "Shift User",
          email: "shift@example.com",
          image: null as string | null,
          departments: null as { name: string } | null,
          sites: null as { name: string } | null,
        },
      }),
    );

    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/attendance/attendance-shift-1",
        {
          method: "PATCH",
        },
      ),
      {
        params: { id: "attendance-shift-1" },
        session: {
          user: {
            id: "admin-1",
          },
        },
        validated: {
          checkIn: "2026-03-20T02:05:00.000Z",
          status: "LATE",
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ON_TIME",
        }),
      }),
    );
    expect(body.data.status).toBe("ON_TIME");
  });
});
